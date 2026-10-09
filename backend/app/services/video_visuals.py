"""Subject-aware scene visuals for interactive videos.

Each scene carries a `visual_type` + `visual_data` the browser player animates:
  bullets   — plain points (default)
  equation  — chemical reaction: reactants → products, animated collision
  formula   — physics/math law with its symbols explained
  diagram   — AI-drawn SVG (an organ, a body system, a cell, a circuit…) whose
              parts light up one by one as the narration reaches them
  process   — ordered steps / a pathway (digestion, blood circulation, a cycle)
  image     — a real educational image from Wikimedia Commons
"""
import re
import xml.etree.ElementTree as ET

import httpx

VISUAL_TYPES = {"bullets", "equation", "formula", "diagram", "process", "image"}

PROMPT = """لكل مشهد اختر العرض البصري الأنسب لما يُشرح فيه (visual_type) وبياناته (visual_data):
- "equation": عند شرح تفاعل/معادلة كيميائية. visual_data:
  {"reactants": [{"formula": "2H2", "name": "هيدروجين"}], "products": [{"formula": "2H2O", "name": "ماء"}],
   "condition": "شرارة كهربية" أو "", "reaction_type": "تفاعل اتحاد", "observation": "ما يُلاحظ أثناء التفاعل"}
  اكتب الصيغ بالحروف اللاتينية والأرقام (H2SO4، Fe2O3، Na+، SO4^2-) والمعامل في بداية الصيغة.
- "formula": عند شرح قانون فيزيائي أو رياضي. visual_data:
  {"expression": "F = m × a", "variables": [{"symbol": "F", "meaning": "القوة", "unit": "نيوتن"}]}
- "diagram": عند شرح عضو أو جهاز حيوي أو خلية أو تركيب أو دائرة كهربية. visual_data:
  {"svg": "<svg viewBox='0 0 800 450' ...>...</svg>", "parts": [{"id": "left_ventricle", "label": "البطين الأيسر", "description": "جملة قصيرة"}]}
  ارسم SVG تخطيطياً واضحاً وملوناً بأشكال بسيطة (path, ellipse, rect, circle, line, polygon) بأبعاد viewBox='0 0 800 450'،
  وكل جزء مشروح عنصر (أو g) عليه data-part مطابق لـ id في parts، بنفس ترتيب الشرح. لا تكتب نصوصاً داخل الـ SVG (الأسماء تظهر من parts)، ولا تستخدم script أو صور خارجية.
- "process": عند شرح خطوات أو مسار أو دورة متتابعة. visual_data:
  {"steps": [{"label": "الفم", "detail": "مضغ الطعام", "icon": "👄"}], "cycle": false}
- "image": عندما تفيد صورة حقيقية (كائن حي، جهاز معملي، ظاهرة طبيعية). visual_data:
  {"query": "كلمات بحث بالإنجليزية لصورة تعليمية في Wikimedia Commons", "caption": "وصف الصورة"}
- "bullets": لأي شرح آخر (visual_data: {}).
النقاط bullets مطلوبة دائماً في كل مشهد (تظهر بجانب العرض البصري)."""

# ── SVG sanitising ───────────────────────────────────────────

_SVG_NS = "http://www.w3.org/2000/svg"
_ALLOWED_TAGS = {
    "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
    "defs", "lineargradient", "radialgradient", "stop", "marker", "title", "use",
}
_ALLOWED_ATTRS = {
    "viewbox", "xmlns", "width", "height", "d", "cx", "cy", "r", "rx", "ry", "x", "y",
    "x1", "y1", "x2", "y2", "points", "fill", "stroke", "stroke-width", "stroke-linecap",
    "stroke-linejoin", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity",
    "transform", "id", "class", "offset", "stop-color", "stop-opacity", "gradientunits",
    "fx", "fy", "markerwidth", "markerheight", "refx", "refy", "orient", "marker-end",
    "marker-start", "data-part", "fill-rule", "preserveaspectratio",
}


def _local(name: str) -> str:
    return name.rsplit("}", 1)[-1].lower()


def sanitize_svg(raw: str) -> str | None:
    """Whitelist-only SVG: no scripts, event handlers, foreignObject or external refs."""
    if not raw or "<svg" not in raw:
        return None
    raw = raw[raw.find("<svg"): raw.rfind("</svg>") + 6]
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None
    if _local(root.tag) != "svg":
        return None

    def clean(el: ET.Element) -> None:
        for child in list(el):
            if _local(child.tag) not in _ALLOWED_TAGS:
                el.remove(child)
                continue
            clean(child)
        for attr in list(el.attrib):
            name = _local(attr)
            val = el.attrib[attr]
            if name == "href":
                if not val.startswith("#"):
                    del el.attrib[attr]
                continue
            if name not in _ALLOWED_ATTRS or "javascript:" in val.lower() or "url(" in val.lower() and not re.fullmatch(r"\s*url\(#[\w-]+\)\s*", val):
                del el.attrib[attr]
        el.text = None if _local(el.tag) != "title" else el.text

    clean(root)
    root.set("viewBox", root.get("viewBox") or "0 0 800 450")
    for dim in ("width", "height"):
        root.attrib.pop(dim, None)
    ET.register_namespace("", _SVG_NS)
    return ET.tostring(root, encoding="unicode")


# ── Normalising per type ─────────────────────────────────────

def _s(v, limit: int = 300) -> str:
    return str(v or "").strip()[:limit]


def _species(items) -> list[dict]:
    out = []
    for it in items or []:
        if isinstance(it, str):
            it = {"formula": it}
        if isinstance(it, dict) and _s(it.get("formula")):
            out.append({"formula": _s(it["formula"], 40), "name": _s(it.get("name"), 60)})
    return out[:6]


def clean_visual(vtype, data) -> tuple[str, dict]:
    vtype = vtype if vtype in VISUAL_TYPES else "bullets"
    data = data if isinstance(data, dict) else {}
    if vtype == "equation":
        r, p = _species(data.get("reactants")), _species(data.get("products"))
        if r and p:
            return vtype, {
                "reactants": r, "products": p,
                "condition": _s(data.get("condition"), 80),
                "reaction_type": _s(data.get("reaction_type"), 80),
                "observation": _s(data.get("observation"), 200),
            }
    elif vtype == "formula":
        if _s(data.get("expression")):
            return vtype, {
                "expression": _s(data["expression"], 120),
                "variables": [
                    {"symbol": _s(v.get("symbol"), 12), "meaning": _s(v.get("meaning"), 60), "unit": _s(v.get("unit"), 30)}
                    for v in (data.get("variables") or []) if isinstance(v, dict) and _s(v.get("symbol"))
                ][:8],
            }
    elif vtype == "diagram":
        svg = sanitize_svg(str(data.get("svg") or ""))
        parts = [
            {"id": _s(pt.get("id"), 60), "label": _s(pt.get("label"), 60), "description": _s(pt.get("description"), 200)}
            for pt in (data.get("parts") or []) if isinstance(pt, dict) and _s(pt.get("id"))
        ][:12]
        if svg:
            return vtype, {"svg": svg, "parts": parts}
    elif vtype == "process":
        steps = [
            {"label": _s(st.get("label"), 60), "detail": _s(st.get("detail"), 120), "icon": _s(st.get("icon"), 8)}
            for st in (data.get("steps") or []) if isinstance(st, dict) and _s(st.get("label"))
        ][:10]
        if len(steps) >= 2:
            return vtype, {"steps": steps, "cycle": bool(data.get("cycle"))}
    elif vtype == "image":
        if _s(data.get("query")) or _s(data.get("url")):
            return vtype, {
                "query": _s(data.get("query"), 120), "caption": _s(data.get("caption"), 200),
                "url": _s(data.get("url"), 1000), "credit": _s(data.get("credit"), 200),
            }
    return "bullets", {}


# ── Wikimedia Commons images ─────────────────────────────────

async def resolve_images(scenes: list[dict]) -> None:
    """Fill image scenes' url from Wikimedia Commons; unresolvable ones fall back to bullets."""
    targets = [s for s in scenes if s.get("visual_type") == "image" and not s["visual_data"].get("url")]
    if not targets:
        return
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "EduPlatform/1.0 (interactive lesson videos)"}) as http:
        for scene in targets:
            data = scene["visual_data"]
            try:
                r = await http.get("https://commons.wikimedia.org/w/api.php", params={
                    "action": "query", "format": "json", "generator": "search",
                    "gsrsearch": f"{data['query']} filetype:bitmap|drawing", "gsrnamespace": 6, "gsrlimit": 5,
                    "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 1280,
                })
                pages = sorted((r.json().get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
                info = next((p["imageinfo"][0] for p in pages if p.get("imageinfo")), None)
            except Exception:
                info = None
            if not info:
                scene["visual_type"], scene["visual_data"] = "bullets", {}
                continue
            meta = info.get("extmetadata") or {}
            artist = re.sub(r"<[^>]+>", "", (meta.get("Artist") or {}).get("value", "")).strip()
            license_ = (meta.get("LicenseShortName") or {}).get("value", "")
            data["url"] = info.get("thumburl") or info.get("url")
            data["credit"] = " · ".join(x for x in (artist[:80], license_, "Wikimedia Commons") if x)

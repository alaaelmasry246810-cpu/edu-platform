"""Interactive video generation — turns curriculum content into scenes,
narration and in-video questions.

Three ways in (see InteractiveVideo.source):
  ai       — AI writes scenes + narration from the lesson/unit, TTS voices each scene.
  podcast  — the teacher's recorded audio is transcribed (Whisper); AI lays timed
             scenes and questions over it.
  upload   — the teacher's video is transcribed when small enough; AI adds timed
             questions (or untimed ones from the curriculum content when it isn't).
"""
import json
import uuid
from pathlib import Path

from app.config import settings
from app.services.rag_service import client, retrieve_full_scope
from app.services import video_visuals

TTS_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
_WHISPER_MAX_BYTES = 25 * 1024 * 1024  # OpenAI transcription upload limit
_INTERACTION_TYPES = {"mcq", "true_false"}

_RULES = """قواعد صارمة:
1. اعتمد فقط على المحتوى المقدم — لا تضف معلومات من خارجه.
2. اكتب بالعربية الفصحى البسيطة المناسبة للطلاب.
3. المحتوى (النص والصور والرسوم) لائق ومناسب لعمر الطلاب وموافق للآداب العامة والقيم.
4. الأسئلة التفاعلية نوعان فقط: "mcq" (4 خيارات، والإجابة الصحيحة نص أحد الخيارات حرفياً) أو "true_false" (الإجابة "صح" أو "خطأ").
5. أعد JSON صالحاً فقط بدون أي نص إضافي."""


async def _chat_json(system: str, user: str, max_tokens: int = 4000) -> dict:
    resp = await client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.4,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(resp.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return {}


async def scope_content(collection: str, filter_metadata: dict) -> str:
    chunks = await retrieve_full_scope(collection, filter_metadata)
    return "\n\n---\n\n".join(chunks)


def _clean_scenes(raw: list, timed: bool) -> list[dict]:
    scenes = []
    for s in raw or []:
        if not isinstance(s, dict) or not (s.get("title") or s.get("narration")):
            continue
        vtype, vdata = video_visuals.clean_visual(s.get("visual_type"), s.get("visual_data"))
        scene = {
            "title": str(s.get("title") or "").strip(),
            "bullets": [str(b).strip() for b in (s.get("bullets") or []) if str(b).strip()][:6],
            "narration": str(s.get("narration") or "").strip(),
            "visual": str(s.get("visual") or "📘").strip()[:8],
            "visual_type": vtype,
            "visual_data": vdata,
        }
        if timed:
            try:
                scene["start"] = max(0.0, float(s.get("start") or 0))
            except (TypeError, ValueError):
                scene["start"] = 0.0
        scenes.append(scene)
    if timed:
        scenes.sort(key=lambda s: s["start"])
    return scenes


def clean_interactions(raw: list, anchor: str, scene_count: int = 0) -> list[dict]:
    """Normalise AI/teacher-edited questions. anchor is "scene" or "time"."""
    out = []
    for q in raw or []:
        if not isinstance(q, dict) or not str(q.get("question") or "").strip():
            continue
        qtype = q.get("type") if q.get("type") in _INTERACTION_TYPES else "mcq"
        options = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
        if qtype == "true_false":
            options = ["صح", "خطأ"]
        elif len(options) < 2:
            continue
        correct = str(q.get("correct_answer") or "").strip()
        if correct not in options:
            continue
        item = {
            "id": str(q.get("id") or uuid.uuid4().hex[:10]),
            "type": qtype,
            "question": str(q["question"]).strip(),
            "options": options,
            "correct_answer": correct,
            "explanation": str(q.get("explanation") or "").strip(),
        }
        if anchor == "scene":
            try:
                idx = int(q.get("after_scene"))
            except (TypeError, ValueError):
                continue
            if scene_count:
                idx = min(max(idx, 0), scene_count - 1)
            item["after_scene"] = idx
        else:
            t = q.get("time")
            try:
                item["time"] = None if t is None or t == "" else max(0.0, float(t))
            except (TypeError, ValueError):
                item["time"] = None
        out.append(item)
    return out


# ── AI-generated video ───────────────────────────────────────

SCRIPT_MODES = {"lesson_text", "explain"}

_SCRIPT_STYLE = {
    # The narration follows the lesson's own text, in order, keeping the book's wording.
    "lesson_text": """السكريبت مأخوذ من نص الدرس نفسه: امشِ على النص بالترتيب من أوله لآخره، وغطِّ كل أفكاره وتعريفاته وأمثلته ومعادلاته دون حذف،
واحتفظ بمصطلحات الكتاب وصياغته قدر الإمكان (يمكن تبسيط الربط بين الجمل فقط). لا تضف مقدمة أو أمثلة من خارج النص.
قسّم المشاهد حسب تقسيم النص الطبيعي (فكرة أو فقرة لكل مشهد)، حوالي {n} مشاهد.""",
    "explain": """اشرح المحتوى بأسلوب مدرس ودود في حوالي {n} مشاهد، أول مشهد مقدمة وآخر مشهد ملخص.""",
}


async def build_ai_script(content: str, title: str, scene_count: int, mode: str = "lesson_text") -> dict:
    style = _SCRIPT_STYLE.get(mode, _SCRIPT_STYLE["lesson_text"]).format(n=scene_count)
    system = f"""أنت مخرج فيديوهات تعليمية. حوّل نص الدرس التالي إلى فيديو شرح تفاعلي يعرض بصرياً ما يُشرح في كل لحظة.
{_RULES}

{video_visuals.PROMPT}

نص الدرس:
{content}"""
    user = f"""اكتب سكريبت فيديو تفاعلي بعنوان "{title}".
{style}
كل مشهد فيه عنوان ونقاط قصيرة تظهر على الشاشة، وعرض بصري مناسب (visual_type و visual_data)، وتعليق صوتي (narration) يقرؤه الراوي.
ضع سؤالاً تفاعلياً بعد كل مشهد أو مشهدين.

الشكل:
{{
  "scenes": [
    {{"title": "...", "bullets": ["...", "..."], "narration": "...", "visual": "إيموجي واحد يعبر عن المشهد", "visual_type": "equation", "visual_data": {{}}}}
  ],
  "interactions": [
    {{"after_scene": 1, "type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": "..."}}
  ]
}}
after_scene هو رقم المشهد (يبدأ من 0) الذي يظهر السؤال بعد انتهائه."""
    data = await _chat_json(system, user, max_tokens=12000)
    scenes = _clean_scenes(data.get("scenes"), timed=False)
    await video_visuals.resolve_images(scenes)
    return {
        "scenes": scenes,
        "interactions": clean_interactions(data.get("interactions"), "scene", len(scenes)),
    }


async def synthesize(text: str, voice: str, out_path: Path) -> None:
    resp = await client.audio.speech.create(
        model="tts-1",
        voice=voice if voice in TTS_VOICES else "nova",
        input=text[:4000],
        response_format="mp3",
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(resp.content)


# ── Podcast / uploaded video ─────────────────────────────────

async def transcribe(path: Path) -> list[dict] | None:
    """Timestamped transcript segments, or None when the file is over Whisper's limit."""
    if path.stat().st_size > _WHISPER_MAX_BYTES:
        return None
    with path.open("rb") as f:
        resp = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    segments = getattr(resp, "segments", None) or []
    out = []
    for s in segments:
        get = s.get if isinstance(s, dict) else lambda k, o=s: getattr(o, k, None)
        out.append({"start": float(get("start") or 0), "end": float(get("end") or 0), "text": str(get("text") or "").strip()})
    return out


def _format_transcript(segments: list[dict]) -> str:
    return "\n".join(f"[{s['start']:.1f}s - {s['end']:.1f}s] {s['text']}" for s in segments)


async def build_timed_script(segments: list[dict], content: str, title: str, with_scenes: bool) -> dict:
    """Scenes (for podcasts) and questions, both timed against the transcript."""
    duration = segments[-1]["end"] if segments else 0
    system = f"""أنت مخرج فيديوهات تعليمية. عندك تفريغ نصي بتوقيتات لتسجيل صوتي/فيديو لمدرس، ومحتوى المنهج المرتبط به.
{_RULES}
5. التوقيتات بالثواني ويجب أن تكون داخل مدة التسجيل ({duration:.0f} ثانية).
{video_visuals.PROMPT if with_scenes else ""}

محتوى المنهج:
{content or "(غير متوفر — اعتمد على التفريغ النصي فقط)"}"""
    scenes_part = """
  "scenes": [
    {"start": 0, "title": "...", "bullets": ["...", "..."], "visual": "إيموجي", "visual_type": "diagram", "visual_data": {}}
  ],""" if with_scenes else ""
    scenes_rule = (
        "قسّم التسجيل إلى مشاهد تتبع كلام المدرس: كل مشهد يبدأ عند start (لحظة بدء المدرس في الفكرة) ويعرض عنواناً ونقاطاً والعرض البصري لما يشرحه في تلك الفترة — "
        "لو بيتكلم عن معادلة اعرض المعادلة والتفاعل، ولو بيشرح عضواً أو جهازاً اعرض رسمه. أول مشهد start = 0.\n"
        if with_scenes else ""
    )
    user = f"""عنوان الفيديو: "{title}"
{scenes_rule}ضع سؤالاً تفاعلياً كل دقيقة أو دقيقتين تقريباً، توقيته (time) بعد انتهاء المدرس من شرح الفكرة التي يسأل عنها مباشرة.

الشكل:
{{{scenes_part}
  "interactions": [
    {{"time": 75.0, "type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": "..."}}
  ]
}}

التفريغ النصي:
{_format_transcript(segments)}"""
    data = await _chat_json(system, user, max_tokens=12000)
    scenes = _clean_scenes(data.get("scenes"), timed=True) if with_scenes else []
    await video_visuals.resolve_images(scenes)
    interactions = [q for q in clean_interactions(data.get("interactions"), "time") if q["time"] is not None and q["time"] <= duration + 1]
    return {"scenes": scenes, "interactions": interactions}


async def build_untimed_questions(content: str, title: str, count: int = 5) -> list[dict]:
    """Fallback for a video we couldn't transcribe: questions from the curriculum,
    in teaching order, with time=null so the player spreads them out."""
    system = f"""أنت مدرس يضع أسئلة تفاعلية داخل فيديو شرح.
{_RULES}

محتوى المنهج:
{content}"""
    user = f"""اكتب {count} أسئلة تفاعلية لفيديو "{title}" مرتبة حسب ترتيب الشرح في المحتوى.
الشكل:
{{"interactions": [{{"type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": "..."}}]}}"""
    data = await _chat_json(system, user, max_tokens=3000)
    items = data.get("interactions") or []
    for q in items:
        if isinstance(q, dict):
            q["time"] = None
    return clean_interactions(items, "time")

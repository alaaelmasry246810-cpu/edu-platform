"""Activity items: AI generation from lesson text, normalising, and building
multiple-choice questions for live games."""
import json
import random

from app.config import settings
from app.services.rag_service import client

TEMPLATES = {
    "quiz", "wheel", "match", "flashcards", "anagram", "crossword", "truefalse",
    "goldquest", "teamboard", "spellit", "whack", "tower",
}
MAX_ITEMS = 60


def clean_items(raw) -> list[dict]:
    out = []
    for it in raw or []:
        if not isinstance(it, dict):
            continue
        q = str(it.get("q") or it.get("question") or it.get("front") or "").strip()[:500]
        a = str(it.get("a") or it.get("answer") or it.get("back") or "").strip()[:200]
        if not q or not a:
            continue
        item = {"q": q, "a": a}
        opts = [str(o).strip()[:200] for o in (it.get("options") or []) if str(o).strip()]
        if len(opts) >= 2:
            if a not in opts:
                opts = [a] + opts[:3]
            item["options"] = list(dict.fromkeys(opts))[:6]
        hint = str(it.get("hint") or "").strip()[:200]
        if hint:
            item["hint"] = hint
        out.append(item)
    return out[:MAX_ITEMS]


async def generate_items(content: str, count: int, title: str) -> list[dict]:
    resp = await client.chat.completions.create(
        model=settings.AI_MODEL,
        messages=[
            {"role": "system", "content": f"""أنت مدرس يصمم أنشطة وألعاباً تعليمية من نص الدرس.
قواعد صارمة:
1. اعتمد فقط على نص الدرس — لا معلومات من خارجه.
2. اكتب بلغة الدرس نفسها.
3. الإجابة a قصيرة (كلمة إلى ثلاث كلمات) لتصلح للعب المطابقة والكلمات المتقاطعة وترتيب الحروف.
4. options أربعة خيارات أحدها a حرفياً، والباقي خاطئة لكن معقولة ومن نفس النوع.
5. أعد JSON صالحاً فقط.

نص الدرس:
{content}"""},
            {"role": "user", "content": f"""اكتب {count} عنصراً لنشاط بعنوان "{title}" تغطي أهم مفاهيم ومصطلحات الدرس بالترتيب.
الشكل: {{"items": [{{"q": "السؤال أو التعريف", "a": "الإجابة القصيرة", "options": ["...", "...", "...", "..."], "hint": "تلميح قصير"}}]}}"""},
        ],
        temperature=0.5,
        max_tokens=6000,
        response_format={"type": "json_object"},
    )
    try:
        data = json.loads(resp.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        data = {}
    return clean_items(data.get("items"))


def build_mcq(items: list[dict], seed: str) -> list[dict]:
    """[{q, options, answer_index}] — distractors come from the other answers
    when an item has no options; the shuffle is seeded so it's stable."""
    rng = random.Random(seed)
    answers = list(dict.fromkeys(it["a"] for it in items))
    out = []
    for it in items:
        opts = list(it.get("options") or [])
        if len(opts) < 2:
            pool = [a for a in answers if a != it["a"]]
            rng.shuffle(pool)
            opts = [it["a"]] + pool[:3]
        if len(opts) < 2:
            continue
        opts = opts[:4]
        rng.shuffle(opts)
        out.append({"q": it["q"], "options": opts, "answer_index": opts.index(it["a"])})
    return out

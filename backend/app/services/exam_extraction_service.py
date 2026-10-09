"""Extract already-written questions/answers from a scanned exam paper.

Deliberately NOT RAG-based and NOT generative: the text passed in is the raw
OCR output of a real exam, and the job is to pull out exactly what's already
written — never invent, rephrase, or supplement it. Contrast with
rag_service.generate_questions, which creates NEW questions from curriculum
context.
"""
import json
import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

VALID_TYPES = {"mcq", "true_false", "fill_blank", "why", "essay", "problem"}

EXTRACTION_PROMPT = """النص ده مأخوذ من ورقة امتحان مكتوبة بالفعل (فيها أسئلة وإجابات حقيقية).
استخرج منه كل سؤال وإجابته بالظبط زي ما هو مكتوب، من غير ما تضيف أو تخترع أو تصلّح أي حاجة.
لو سؤال إجابته مش واضحة أو مش موجودة في النص، سيب correct_answer فاضية.
لو النص مفيهوش أي أسئلة واضحة خالص، أعد مصفوفة فاضية [].

صنّف كل سؤال لنوع واحد بالظبط من دول: mcq, true_false, fill_blank, why, essay, problem.

النص:
{text}

أعد JSON مصفوفة بالشكل ده بالظبط ومن غير أي نص إضافي:
[
  {{"type": "mcq", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "explanation": null}},
  {{"type": "why", "question": "...", "options": null, "correct_answer": "...", "explanation": null}}
]
"""


async def extract_exam_questions(text: str) -> list[dict]:
    """Return [{type, question, options, correct_answer, explanation}, ...]
    extracted verbatim from the given exam text. Never raises — returns []
    on any failure so one bad lesson can't fail the whole upload."""
    if not text or not text.strip():
        return []

    try:
        response = await client.chat.completions.create(
            model=settings.AI_MODEL,
            messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(text=text[:12000])}],
            temperature=0,
        )
        raw = response.choices[0].message.content or ""
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start < 0 or end <= start:
            return []
        items = json.loads(raw[start:end])
    except Exception:
        logger.exception("Exam question extraction failed")
        return []

    results = []
    for item in items:
        if not isinstance(item, dict) or not item.get("question"):
            continue
        q_type = item.get("type") if item.get("type") in VALID_TYPES else "essay"
        results.append({
            "type": q_type,
            "question": item.get("question", ""),
            "options": item.get("options"),
            "correct_answer": item.get("correct_answer") or "",
            "explanation": item.get("explanation"),
        })
    return results

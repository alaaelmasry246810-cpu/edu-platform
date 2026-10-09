"""RAG Service — vector storage, retrieval, and AI generation with zero hallucinations."""
import uuid
from typing import Any
from openai import AsyncOpenAI
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue, SearchRequest, PayloadSchemaType
)
from app.config import settings

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
qdrant = (
    AsyncQdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY or None)
    if settings.QDRANT_URL
    else AsyncQdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
)


async def ensure_collection(collection_name: str) -> None:
    """Create Qdrant collection if it doesn't exist."""
    existing = await qdrant.get_collections()
    names = [c.name for c in existing.collections]
    if collection_name not in names:
        await qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=settings.EMBEDDING_DIMENSION,
                distance=Distance.COSINE
            )
        )
        # retrieve_full_scope() filters/scrolls on these metadata fields —
        # Qdrant requires an explicit payload index to filter on a field at all.
        for field in ("curriculum_id", "unit_id", "lesson_id"):
            await qdrant.create_payload_index(
                collection_name=collection_name,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )


async def embed_text(text: str) -> list[float]:
    """Convert text to embedding vector."""
    resp = await client.embeddings.create(
        model=settings.EMBEDDING_MODEL,
        input=text[:8000]  # token safety
    )
    return resp.data[0].embedding


async def index_chunks(collection_name: str, chunks: list[dict]) -> int:
    """Store document chunks in Qdrant with metadata."""
    await ensure_collection(collection_name)

    points = []
    for chunk in chunks:
        vector = await embed_text(chunk["text"])
        points.append(PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={
                "text": chunk["text"],
                **chunk.get("metadata", {}),
            }
        ))

    await qdrant.upsert(collection_name=collection_name, points=points)
    return len(points)


async def retrieve_full_scope(
    collection_name: str,
    filter_metadata: dict | None = None,
    max_chunks: int | None = None,
) -> list[str]:
    """Fetch every chunk in the given curriculum/unit/lesson scope, in
    reading order — no similarity search involved.

    Every caller here already scopes the request by curriculum_id/unit_id/
    lesson_id via `filter_metadata`, and what's needed inside that scope is
    full coverage, not whichever chunks happen to rank highest against a
    generic instruction like "create 10 questions..." (which never scores
    meaningfully against real content no matter how relevant it is — the old
    similarity-search approach silently capped every generation at ~8 chunks
    regardless of how big the actual scope was, which is why unit/curriculum
    -wide questions and summaries came out unrepresentative of the material).

    Bounded by max_chunks so a whole-curriculum scope doesn't blow up token
    cost/latency on a huge document.
    """
    limit = max_chunks or settings.RAG_MAX_GENERATION_CHUNKS

    must_conditions = []
    if filter_metadata:
        for key, value in filter_metadata.items():
            must_conditions.append(FieldCondition(key=key, match=MatchValue(value=value)))
    scroll_filter = Filter(must=must_conditions) if must_conditions else None

    try:
        points, _ = await qdrant.scroll(
            collection_name=collection_name,
            scroll_filter=scroll_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
    except Exception:
        return []

    points.sort(key=lambda p: (p.payload.get("lesson_id") or "", p.payload.get("chunk_index", 0)))
    return [p.payload["text"] for p in points]


async def generate_with_rag(
    collection_name: str,
    task: str,
    filter_metadata: dict | None = None,
    system_extra: str = "",
    model: str | None = None,
    max_chunks: int | None = None,
) -> str:
    """Core RAG generation — always grounded in the full scoped curriculum content."""
    context_chunks = await retrieve_full_scope(collection_name, filter_metadata, max_chunks=max_chunks)

    if not context_chunks:
        return "لم يتم العثور على محتوى كافٍ في المنهج لهذا الطلب."

    context = "\n\n---\n\n".join(context_chunks)
    ai_model = model or settings.AI_MODEL

    system_prompt = f"""أنت مساعد تعليمي متخصص. مهمتك هي مساعدة الطلاب في فهم المناهج الدراسية.

قواعد صارمة:
1. أجب فقط بناءً على المحتوى المقدم أدناه — لا تستخدم أي معلومات خارجية.
2. إذا لم يكن الجواب في المحتوى، قل: "هذه المعلومة غير موجودة في المنهج المرفوع."
3. أجب باللغة العربية الفصحى البسيطة.
4. كن دقيقاً وشاملاً.
{system_extra}

محتوى المنهج:
{context}"""

    resp = await client.chat.completions.create(
        model=ai_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task},
        ],
        temperature=0.3,  # Low temperature = less hallucination
        max_tokens=2000,
    )
    return resp.choices[0].message.content


async def generate_questions(
    collection_name: str,
    question_types: list[str],
    filter_metadata: dict | None = None,
    count: int = 10,
    difficulty: str = "medium",
    model: str | None = None
) -> list[dict]:
    """Generate a question bank from curriculum content."""
    type_names = {
        "mcq": "اختيار من متعدد (4 خيارات)",
        "true_false": "صح وخطأ",
        "fill_blank": "أكمل الفراغ",
        "why": "علل / اشرح لماذا",
        "essay": "مقالي",
        "problem": "مسائل وقواعد",
    }
    requested_types = [type_names.get(t, t) for t in question_types]

    task = f"""
أنشئ بالضبط {count} سؤالاً من المنهج المرفوع بالأنواع التالية: {', '.join(requested_types)}.
مستوى الصعوبة: {difficulty}.

أعد الأسئلة بصيغة JSON مصفوفة بهذا الشكل:
[
  {{
    "type": "mcq",
    "question": "نص السؤال",
    "options": ["أ", "ب", "ج", "د"],
    "correct_answer": "أ",
    "explanation": "شرح الإجابة الصحيحة"
  }},
  {{
    "type": "why",
    "question": "علل ...",
    "correct_answer": "الإجابة الكاملة",
    "explanation": null
  }}
]

أعد JSON فقط بدون أي نص إضافي.
"""
    import json
    raw = await generate_with_rag(collection_name, task, filter_metadata, model=model)

    # Parse JSON from response
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception:
        pass
    return []


async def generate_flashcards(
    collection_name: str,
    filter_metadata: dict | None = None,
    count: int = 12,
    model: str | None = None
) -> list[dict]:
    """
    Generate interactive flashcards from lesson content.
    Returns [{front, back, hint, category}] — Egyptian Arabic dialect for student engagement.
    """
    import json
    task = f"""
اعمل بالظبط {count} فلاش كارد تعليمية من محتوى الدرس ده.
اكتب بالعامية المصرية البسيطة عشان الطالب يفهم بسهولة.

الفلاش كارد لازم تكون:
- وجه أمامي (front): سؤال أو مصطلح أو فكرة رئيسية — قصير ومباشر
- وجه خلفي (back): الإجابة أو الشرح أو التعريف — واضح ومفيد
- hint: تلميح بسيط يساعد الطالب قبل ما يقلب الكارت
- category: تصنيف الكارت (مثلاً: تعريف / مفهوم / قانون / مثال)

أعد JSON مصفوفة بالشكل ده:
[
  {{
    "front": "إيه هو ...",
    "back": "هو عبارة عن ...",
    "hint": "فكر في ...",
    "category": "تعريف"
  }}
]

أعد JSON بس من غير أي كلام تاني.
"""
    raw = await generate_with_rag(collection_name, task, filter_metadata, model=model)
    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
    except Exception:
        pass
    return []


async def delete_curriculum_vectors(collection_name: str, curriculum_id: str) -> None:
    """Remove all vectors for a curriculum."""
    await qdrant.delete(
        collection_name=collection_name,
        points_selector=Filter(must=[
            FieldCondition(key="curriculum_id", match=MatchValue(value=curriculum_id))
        ])
    )

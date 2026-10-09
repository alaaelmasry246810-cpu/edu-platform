"""The text of a lesson (or a whole unit) for AI generation, best source first:
text the teacher pasted → the lesson's own extracted text → its RAG chunks
(the same text, chunked) → the lessons' cached AI explanation/summary (when
the vector store has nothing or is down)."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.curriculum import Curriculum, Lesson
from app.services.rag_service import retrieve_full_scope

MAX_CONTENT_CHARS = 60_000


async def scope_lessons(db: AsyncSession, lesson_id: uuid.UUID | None, unit_id: uuid.UUID | None) -> list[Lesson]:
    if lesson_id:
        q = select(Lesson).where(Lesson.id == lesson_id)
    elif unit_id:
        q = select(Lesson).where(Lesson.unit_id == unit_id).order_by(Lesson.order)
    else:
        return []
    return list((await db.execute(q)).scalars().all())


def _joined(lessons: list[Lesson], attr) -> str:
    return "\n\n".join(f"## {l.title}\n{attr(l)}" for l in lessons if attr(l))[:MAX_CONTENT_CHARS]


async def lesson_text(
    db: AsyncSession, curriculum: Curriculum,
    lesson_id: uuid.UUID | None, unit_id: uuid.UUID | None, pasted: str | None = None,
) -> str:
    """The lesson/unit's own text (no AI-written fallback)."""
    if pasted and pasted.strip():
        return pasted.strip()[:MAX_CONTENT_CHARS]
    content = _joined(await scope_lessons(db, lesson_id, unit_id), lambda l: l.content_text)
    if content:
        return content
    flt = {"lesson_id": str(lesson_id)} if lesson_id else {"unit_id": str(unit_id)}
    chunks = await retrieve_full_scope(curriculum.vector_collection_id, flt)
    return "\n\n---\n\n".join(chunks)[:MAX_CONTENT_CHARS]


async def generation_text(
    db: AsyncSession, curriculum: Curriculum,
    lesson_id: uuid.UUID | None, unit_id: uuid.UUID | None, pasted: str | None = None,
) -> str:
    """Lesson text, else the cached AI explanation/summary."""
    return await lesson_text(db, curriculum, lesson_id, unit_id, pasted) or \
        _joined(await scope_lessons(db, lesson_id, unit_id), lambda l: l.explanation or l.summary)

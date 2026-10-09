"""Shared Question Bank — teachers publish and browse shared questions."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.question_bank import SharedQuestion
from app.models.curriculum import Curriculum, Question, QuestionType
from app.middleware.auth import get_current_user, check_quota
from app.services import rag_service

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])

_MAX_GENERATE_COUNT = 30
_MAX_PUBLISH_BATCH = 100


def _require_teacher(user: User):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")


def _get_collection(curriculum: Curriculum) -> str:
    return curriculum.vector_collection_id or f"curr_{curriculum.id.hex[:12]}"


async def _get_owned_curriculum(curriculum_id: uuid.UUID, teacher_id: uuid.UUID, db: AsyncSession) -> Curriculum:
    r = await db.execute(
        select(Curriculum).where(Curriculum.id == curriculum_id, Curriculum.owner_id == teacher_id)
    )
    curriculum = r.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


# ── Browse ────────────────────────────────────────────────────

@router.get("")
async def browse_questions(
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    curriculum_id: Optional[uuid.UUID] = None,
    unit_id: Optional[uuid.UUID] = None,
    lesson_id: Optional[uuid.UUID] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Browse public shared questions with optional filters."""
    _require_teacher(current_user)
    q = select(SharedQuestion).where(SharedQuestion.is_public == True)
    if subject:       q = q.where(SharedQuestion.subject_tag.ilike(f"%{subject}%"))
    if grade_level:   q = q.where(SharedQuestion.grade_level == grade_level)
    if question_type: q = q.where(SharedQuestion.question_type == question_type)
    if difficulty:    q = q.where(SharedQuestion.difficulty == difficulty)
    if search:        q = q.where(SharedQuestion.question.ilike(f"%{search}%"))
    if curriculum_id: q = q.where(SharedQuestion.curriculum_id == curriculum_id)
    if unit_id:       q = q.where(SharedQuestion.unit_id == unit_id)
    if lesson_id:     q = q.where(SharedQuestion.lesson_id == lesson_id)
    q = q.order_by(SharedQuestion.use_count.desc(), SharedQuestion.created_at.desc()).offset(offset).limit(limit)
    r = await db.execute(q)
    questions = r.scalars().all()

    # Count for pagination
    count_q = select(func.count()).select_from(SharedQuestion).where(SharedQuestion.is_public == True)
    if subject:       count_q = count_q.where(SharedQuestion.subject_tag.ilike(f"%{subject}%"))
    if grade_level:   count_q = count_q.where(SharedQuestion.grade_level == grade_level)
    if question_type: count_q = count_q.where(SharedQuestion.question_type == question_type)
    if difficulty:    count_q = count_q.where(SharedQuestion.difficulty == difficulty)
    if search:        count_q = count_q.where(SharedQuestion.question.ilike(f"%{search}%"))
    if curriculum_id: count_q = count_q.where(SharedQuestion.curriculum_id == curriculum_id)
    if unit_id:       count_q = count_q.where(SharedQuestion.unit_id == unit_id)
    if lesson_id:     count_q = count_q.where(SharedQuestion.lesson_id == lesson_id)
    total = (await db.execute(count_q)).scalar() or 0

    return {
        "total": total,
        "questions": [_serialize(q, str(current_user.id)) for q in questions]
    }


@router.get("/my")
async def my_questions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List questions published by the current teacher."""
    _require_teacher(current_user)
    r = await db.execute(
        select(SharedQuestion)
        .where(SharedQuestion.teacher_id == current_user.id)
        .order_by(SharedQuestion.created_at.desc())
    )
    return [_serialize(q, str(current_user.id)) for q in r.scalars().all()]


# ── Generate from curriculum ─────────────────────────────────

class GenerateRequest(BaseModel):
    curriculum_id: uuid.UUID
    unit_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    types: list[str] = ["mcq", "true_false", "why"]
    count: int = 10
    difficulty: str = "medium"


@router.post("/generate")
async def generate_from_curriculum(
    body: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Produce candidate questions scoped to one of the teacher's curricula
    (optionally narrowed to a unit/lesson), for review before publishing to
    the shared bank. For an already-written exam paper (content_type="exam")
    this pulls the questions extracted verbatim on upload; for a regular
    curriculum it asks the RAG pipeline to generate new ones from the content."""
    _require_teacher(current_user)
    if body.count <= 0 or body.count > _MAX_GENERATE_COUNT:
        raise HTTPException(status_code=400, detail=f"العدد لازم يكون بين 1 و{_MAX_GENERATE_COUNT}")

    curriculum = await _get_owned_curriculum(body.curriculum_id, current_user.id, db)

    if curriculum.content_type == "exam":
        type_enums = []
        for t in body.types:
            try:
                type_enums.append(QuestionType(t))
            except ValueError:
                continue
        if not type_enums:
            raise HTTPException(status_code=400, detail="نوع سؤال غير معروف")
        q = select(Question).where(
            Question.curriculum_id == curriculum.id,
            Question.question_type.in_(type_enums),
        )
        if body.lesson_id:
            q = q.where(Question.lesson_id == body.lesson_id)
        elif body.unit_id:
            q = q.where(Question.unit_id == body.unit_id)
        q = q.order_by(func.random()).limit(body.count)
        r = await db.execute(q)
        candidates = [
            {
                "type": row.question_type.value,
                "question": row.question_text,
                "options": row.options,
                "correct_answer": row.correct_answer,
                "explanation": row.explanation,
            }
            for row in r.scalars().all()
        ]
        source = "extracted"
    else:
        check_quota(current_user, "questions")
        filter_meta = {"curriculum_id": str(curriculum.id)}
        if body.lesson_id:
            filter_meta["lesson_id"] = str(body.lesson_id)
        elif body.unit_id:
            filter_meta["unit_id"] = str(body.unit_id)

        candidates = await rag_service.generate_questions(
            _get_collection(curriculum),
            question_types=body.types,
            filter_metadata=filter_meta,
            count=body.count,
            difficulty=body.difficulty,
        )
        current_user.questions_generated_today += len(candidates)
        await db.commit()
        source = "generated"

    return {
        "questions": candidates,
        "source": source,
        "subject_tag": curriculum.subject,
        "grade_level": curriculum.grade_level,
    }


class BatchQuestionItem(BaseModel):
    question: str
    question_type: str
    correct_answer: Optional[str] = None
    options: Optional[list[str]] = None
    explanation: Optional[str] = None


class PublishBatchRequest(BaseModel):
    curriculum_id: uuid.UUID
    unit_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None
    difficulty: str = "medium"
    points: float = 2.0
    is_public: bool = True
    questions: list[BatchQuestionItem]


@router.post("/publish-batch")
async def publish_batch(
    body: PublishBatchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Publish several generated/extracted candidates to the shared bank at
    once, tagged with the curriculum's subject/grade so the bank stays
    organized by subject → curriculum → unit → lesson.

    A candidate with no correct_answer is published as-is rather than
    skipped — /exam/submit and /exam/{id}/check both route a question with
    no known answer to the teacher instead of auto-grading it, so it's safe
    to keep in the bank for a teacher to grade manually later."""
    _require_teacher(current_user)
    if not body.questions:
        raise HTTPException(status_code=400, detail="لا يوجد أسئلة للنشر")
    if len(body.questions) > _MAX_PUBLISH_BATCH:
        raise HTTPException(status_code=400, detail=f"الحد الأقصى {_MAX_PUBLISH_BATCH} سؤال في المرة الواحدة")

    curriculum = await _get_owned_curriculum(body.curriculum_id, current_user.id, db)

    saved = []
    for item in body.questions:
        q = SharedQuestion(
            teacher_id=current_user.id,
            curriculum_id=curriculum.id,
            unit_id=body.unit_id,
            lesson_id=body.lesson_id,
            question=item.question,
            question_type=item.question_type,
            correct_answer=item.correct_answer,
            options=item.options,
            explanation=item.explanation,
            difficulty=body.difficulty,
            subject_tag=curriculum.subject,
            grade_level=curriculum.grade_level,
            points=body.points,
            is_public=body.is_public,
        )
        db.add(q)
        saved.append(q)

    await db.commit()
    for q in saved:
        await db.refresh(q)

    return {
        "published": len(saved),
        "questions": [_serialize(q, str(current_user.id)) for q in saved],
    }


# ── Publish ───────────────────────────────────────────────────

class PublishRequest(BaseModel):
    question: str
    question_type: str
    correct_answer: Optional[str] = None
    options: Optional[list[str]] = None
    explanation: Optional[str] = None
    difficulty: str = "medium"
    subject_tag: Optional[str] = None
    grade_level: Optional[str] = None
    points: float = 2.0
    is_public: bool = True
    curriculum_id: Optional[uuid.UUID] = None
    unit_id: Optional[uuid.UUID] = None
    lesson_id: Optional[uuid.UUID] = None


@router.post("")
async def publish_question(
    body: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher publishes a question to the shared library, optionally tagged
    to one of their own curricula/units/lessons."""
    _require_teacher(current_user)

    if body.curriculum_id:
        owns = await db.execute(
            select(Curriculum.id).where(
                Curriculum.id == body.curriculum_id, Curriculum.owner_id == current_user.id
            )
        )
        if not owns.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Curriculum not found")

    q = SharedQuestion(
        teacher_id=current_user.id,
        curriculum_id=body.curriculum_id,
        unit_id=body.unit_id if body.curriculum_id else None,
        lesson_id=body.lesson_id if body.curriculum_id else None,
        question=body.question,
        question_type=body.question_type,
        correct_answer=body.correct_answer,
        options=body.options,
        explanation=body.explanation,
        difficulty=body.difficulty,
        subject_tag=body.subject_tag,
        grade_level=body.grade_level,
        points=body.points,
        is_public=body.is_public,
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return _serialize(q, str(current_user.id))


@router.delete("/{question_id}")
async def delete_question(
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete own published question."""
    _require_teacher(current_user)
    r = await db.execute(select(SharedQuestion).where(SharedQuestion.id == question_id))
    q = r.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    if q.teacher_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.delete(q)
    await db.commit()
    return {"message": "تم الحذف"}


# ── Import ────────────────────────────────────────────────────

@router.post("/{question_id}/import")
async def import_question(
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Increment use_count and return the question data to import into an exam/curriculum."""
    _require_teacher(current_user)
    r = await db.execute(select(SharedQuestion).where(SharedQuestion.id == question_id))
    q = r.scalar_one_or_none()
    if not q or not q.is_public:
        raise HTTPException(status_code=404, detail="Not found")
    q.use_count += 1
    await db.commit()
    return _serialize(q, str(current_user.id))


# ── Helpers ───────────────────────────────────────────────────

def _serialize(q: SharedQuestion, current_user_id: str) -> dict:
    return {
        "id": str(q.id),
        "teacher_id": str(q.teacher_id),
        "is_mine": str(q.teacher_id) == current_user_id,
        "curriculum_id": str(q.curriculum_id) if q.curriculum_id else None,
        "unit_id": str(q.unit_id) if q.unit_id else None,
        "lesson_id": str(q.lesson_id) if q.lesson_id else None,
        "question": q.question,
        "question_type": q.question_type,
        "correct_answer": q.correct_answer,
        "options": q.options,
        "explanation": q.explanation,
        "difficulty": q.difficulty,
        "subject_tag": q.subject_tag,
        "grade_level": q.grade_level,
        "points": q.points,
        "is_public": q.is_public,
        "use_count": q.use_count,
        "created_at": q.created_at.isoformat(),
    }

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
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/question-bank", tags=["Question Bank"])


def _require_teacher(user: User):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")


# ── Browse ────────────────────────────────────────────────────

@router.get("")
async def browse_questions(
    subject: Optional[str] = None,
    grade_level: Optional[str] = None,
    question_type: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
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


@router.post("")
async def publish_question(
    body: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher publishes a question to the shared library."""
    _require_teacher(current_user)
    q = SharedQuestion(
        teacher_id=current_user.id,
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

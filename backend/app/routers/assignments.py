"""Teacher-assigned exams/practice — a teacher creates one, targets specific
students (ad hoc and/or via a saved StudentGroup), optionally schedules it,
and each targeted student starts their own attempt lazily when ready."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum
from app.models.exam import QuizAttempt, ExamType, AttemptStatus
from app.models.assignment import Assignment, AssignmentTarget, StudentGroup
from app.middleware.auth import get_current_user, check_quota
from app.services.notification_service import notify
from app.services import teachers as links
from app.routers.ai import _create_attempt_for_student

router = APIRouter(prefix="/assignments", tags=["Assignments"])


def _require_teacher(current_user: User) -> User:
    if current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")
    return current_user


# ── Student groups ───────────────────────────────────────────

class GroupRequest(BaseModel):
    name: str
    student_ids: list[uuid.UUID]


async def _validate_students_belong_to_teacher(student_ids: list[uuid.UUID], teacher_id: uuid.UUID, db: AsyncSession):
    if not student_ids:
        return
    r = await db.execute(
        select(func.count(User.id)).where(
            User.id.in_(student_ids), links.students_of(teacher_id), User.role == UserRole.STUDENT
        )
    )
    if r.scalar_one() != len(set(student_ids)):
        raise HTTPException(status_code=400, detail="One or more students don't belong to you")


@router.post("/groups")
async def create_group(
    body: GroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _require_teacher(current_user)
    await _validate_students_belong_to_teacher(body.student_ids, current_user.id, db)
    group = StudentGroup(
        teacher_id=current_user.id,
        name=body.name,
        student_ids=[str(sid) for sid in body.student_ids],
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return _serialize_group(group)


@router.get("/groups")
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _require_teacher(current_user)
    r = await db.execute(
        select(StudentGroup).where(StudentGroup.teacher_id == current_user.id).order_by(StudentGroup.name)
    )
    return [_serialize_group(g) for g in r.scalars().all()]


@router.put("/groups/{group_id}")
async def update_group(
    group_id: uuid.UUID,
    body: GroupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _require_teacher(current_user)
    group = await _get_owned_group(group_id, current_user, db)
    await _validate_students_belong_to_teacher(body.student_ids, current_user.id, db)
    group.name = body.name
    group.student_ids = [str(sid) for sid in body.student_ids]
    await db.commit()
    return _serialize_group(group)


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _require_teacher(current_user)
    group = await _get_owned_group(group_id, current_user, db)
    await db.delete(group)
    await db.commit()
    return {"message": "تم حذف المجموعة"}


async def _get_owned_group(group_id: uuid.UUID, current_user: User, db: AsyncSession) -> StudentGroup:
    r = await db.execute(
        select(StudentGroup).where(StudentGroup.id == group_id, StudentGroup.teacher_id == current_user.id)
    )
    group = r.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


def _serialize_group(g: StudentGroup) -> dict:
    return {
        "id": str(g.id),
        "name": g.name,
        "student_ids": g.student_ids,
        "created_at": g.created_at.isoformat(),
    }


# ── Assignments ──────────────────────────────────────────────

class AssignmentCreateRequest(BaseModel):
    kind: str = "practice"  # "exam" | "practice" — display/filter label only
    title: str
    curriculum_id: uuid.UUID
    exam_type: ExamType = ExamType.COMPREHENSIVE
    lesson_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    student_ids: list[uuid.UUID] = []
    group_id: uuid.UUID | None = None
    available_from: datetime | None = None
    due_at: datetime | None = None
    time_limit_minutes: int | None = None
    allow_multiple_attempts: bool = False
    auto_reveal_score: bool = False


@router.post("")
async def create_assignment(
    body: AssignmentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    _require_teacher(current_user)

    if body.time_limit_minutes is not None and not (1 <= body.time_limit_minutes <= 300):
        raise HTTPException(status_code=400, detail="مدة الاختبار لازم تكون بين 1 و300 دقيقة")

    target_ids: set[str] = {str(sid) for sid in body.student_ids}
    if body.group_id:
        group = await _get_owned_group(body.group_id, current_user, db)
        target_ids.update(group.student_ids)

    if not target_ids:
        raise HTTPException(status_code=400, detail="Choose at least one student or group")

    await _validate_students_belong_to_teacher([uuid.UUID(sid) for sid in target_ids], current_user.id, db)

    curr = await db.execute(select(Curriculum).where(Curriculum.id == body.curriculum_id))
    if not curr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Curriculum not found")

    assignment = Assignment(
        teacher_id=current_user.id,
        kind=body.kind,
        title=body.title,
        curriculum_id=body.curriculum_id,
        exam_type=body.exam_type,
        lesson_id=body.lesson_id,
        unit_id=body.unit_id,
        group_id=body.group_id,
        available_from=body.available_from,
        due_at=body.due_at,
        time_limit_minutes=body.time_limit_minutes,
        allow_multiple_attempts=body.allow_multiple_attempts,
        auto_reveal_score=body.auto_reveal_score,
    )
    db.add(assignment)
    await db.flush()

    for sid in target_ids:
        db.add(AssignmentTarget(assignment_id=assignment.id, student_id=uuid.UUID(sid)))

    label = "تدريب" if body.kind == "practice" else "امتحان"
    for sid in target_ids:
        await notify(
            db,
            user_id=uuid.UUID(sid),
            title=f"{label} جديد: {body.title} 📝",
            body=f"معلمك أضافلك {label} جديد",
            notif_type="assignment_created",
            link=f"/dashboard/assignments/{assignment.id}",
        )

    await db.commit()
    return {"id": str(assignment.id), "target_count": len(target_ids)}


@router.get("")
async def list_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher's created assignments, with a completion summary per one."""
    _require_teacher(current_user)
    r = await db.execute(
        select(Assignment).where(Assignment.teacher_id == current_user.id).order_by(Assignment.created_at.desc())
    )
    assignments = r.scalars().all()

    result = []
    for a in assignments:
        target_count = await db.scalar(
            select(func.count(AssignmentTarget.id)).where(AssignmentTarget.assignment_id == a.id)
        )
        submitted_count = await db.scalar(
            select(func.count(QuizAttempt.id)).where(
                QuizAttempt.assignment_id == a.id,
                QuizAttempt.status != AttemptStatus.IN_PROGRESS,
            )
        )
        result.append({**_serialize_assignment(a), "target_count": target_count, "submitted_count": submitted_count})
    return result


@router.get("/mine")
async def my_assignments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Assignments targeting the current student."""
    r = await db.execute(
        select(Assignment)
        .join(AssignmentTarget, AssignmentTarget.assignment_id == Assignment.id)
        .where(AssignmentTarget.student_id == current_user.id)
        .order_by(Assignment.created_at.desc())
    )
    assignments = r.scalars().all()

    result = []
    for a in assignments:
        r_attempt = await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.assignment_id == a.id, QuizAttempt.student_id == current_user.id)
            .order_by(QuizAttempt.started_at.desc())
        )
        attempts = r_attempt.scalars().all()
        result.append({
            **_serialize_assignment(a),
            "attempt_count": len(attempts),
            "last_attempt": _serialize_attempt_summary(attempts[0]) if attempts else None,
        })
    return result


@router.get("/{assignment_id}")
async def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher's roster view: every targeted student + their attempt status."""
    _require_teacher(current_user)
    r = await db.execute(
        select(Assignment).where(Assignment.id == assignment_id, Assignment.teacher_id == current_user.id)
    )
    assignment = r.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    r_targets = await db.execute(
        select(AssignmentTarget, User)
        .join(User, User.id == AssignmentTarget.student_id)
        .where(AssignmentTarget.assignment_id == assignment_id)
    )
    roster = []
    for _target, student in r_targets.all():
        r_attempt = await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.assignment_id == assignment_id, QuizAttempt.student_id == student.id)
            .order_by(QuizAttempt.started_at.desc())
        )
        attempts = r_attempt.scalars().all()
        roster.append({
            "student_id": str(student.id),
            "full_name": student.full_name,
            "attempt_count": len(attempts),
            "last_attempt": _serialize_attempt_summary(attempts[0]) if attempts else None,
        })

    return {**_serialize_assignment(assignment), "roster": roster}


@router.post("/{assignment_id}/start")
async def start_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(AssignmentTarget).where(
            AssignmentTarget.assignment_id == assignment_id, AssignmentTarget.student_id == current_user.id
        )
    )
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="This assignment isn't targeted at you")

    r_assign = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = r_assign.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    now = datetime.utcnow()
    if assignment.available_from and now < assignment.available_from:
        raise HTTPException(status_code=403, detail="This assignment isn't open yet")
    if assignment.due_at and now > assignment.due_at:
        raise HTTPException(status_code=403, detail="This assignment's deadline has passed")

    if not assignment.allow_multiple_attempts:
        r_existing = await db.execute(
            select(func.count(QuizAttempt.id)).where(
                QuizAttempt.assignment_id == assignment_id, QuizAttempt.student_id == current_user.id
            )
        )
        if r_existing.scalar_one() > 0:
            raise HTTPException(status_code=409, detail="You've already attempted this assignment")

    check_quota(current_user, "questions")
    return await _create_attempt_for_student(
        db, current_user, assignment.curriculum_id, assignment.exam_type,
        assignment.lesson_id, assignment.unit_id, assignment_id=assignment.id,
        time_limit_override=assignment.time_limit_minutes,
    )


def _serialize_assignment(a: Assignment) -> dict:
    return {
        "id": str(a.id),
        "kind": a.kind,
        "title": a.title,
        "curriculum_id": str(a.curriculum_id),
        "exam_type": a.exam_type.value,
        "available_from": a.available_from.isoformat() if a.available_from else None,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "time_limit_minutes": a.time_limit_minutes,
        "allow_multiple_attempts": a.allow_multiple_attempts,
        "auto_reveal_score": a.auto_reveal_score,
        "created_at": a.created_at.isoformat(),
    }


def _serialize_attempt_summary(attempt: QuizAttempt) -> dict:
    return {
        "id": str(attempt.id),
        "status": attempt.status.value,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    }

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from uuid import UUID
from datetime import datetime
import uuid as _uuid
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.database import get_db
from app.models.user import User, AccountStatus, SubscriptionPlan, UserRole
from app.models.curriculum import Curriculum
from app.schemas.user import UserPublic, AdminUserUpdate, AdminSettings
from app.middleware.auth import get_admin_user
from app.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# All possible feature flags admins can grant to teachers
TEACHER_FEATURE_FLAGS = [
    "can_grant_ai_assist",      # teacher can enable AI exam assist for their students
    "can_export_pdf",           # teacher can export student exams as PDF
    "can_access_question_bank", # teacher can use the shared question bank
    "can_view_analytics",       # teacher can view advanced analytics
    "can_add_channel_links",    # teacher can publish links to their own educational channels
]

router = APIRouter(prefix="/admin", tags=["Admin"])

# In-memory dynamic settings store (production: use Redis/DB)
_dynamic_settings: dict = {}


@router.get("/stats")
async def dashboard_stats(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Overall platform statistics."""
    total_users = await db.scalar(select(func.count(User.id)))
    pending_users = await db.scalar(select(func.count(User.id)).where(User.status == AccountStatus.PENDING))
    active_users = await db.scalar(select(func.count(User.id)).where(User.status == AccountStatus.ACTIVE))
    paid_users = await db.scalar(
        select(func.count(User.id)).where(User.plan.in_([SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY]))
    )
    total_curricula = await db.scalar(select(func.count(Curriculum.id)))

    return {
        "users": {
            "total": total_users,
            "pending": pending_users,
            "active": active_users,
            "paid": paid_users,
        },
        "curricula": {"total": total_curricula},
        "ai_model": _dynamic_settings.get("ai_model", settings.AI_MODEL),
        "rag_top_k": _dynamic_settings.get("rag_top_k", settings.RAG_TOP_K),
    }


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    status: AccountStatus | None = Query(None),
    plan: SubscriptionPlan | None = Query(None),
    skip: int = 0,
    limit: int = 50,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    q = select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    if status:
        q = q.where(User.status == status)
    if plan:
        q = q.where(User.plan == plan)
    result = await db.execute(q)
    return [UserPublic.model_validate(u) for u in result.scalars().all()]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    body: AdminUserUpdate,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.status is not None:
        user.status = body.status
        if body.status != AccountStatus.SUSPENDED:
            user.suspension_reason = None
    if body.plan is not None:
        user.plan = body.plan
        if body.plan in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
            from datetime import timedelta
            days = 30 if body.plan == SubscriptionPlan.MONTHLY else 365
            user.subscription_expires_at = datetime.utcnow() + timedelta(days=days)
    if body.role is not None:
        user.role = body.role

    return {"message": "User updated", "user": UserPublic.model_validate(user)}


def _generate_temp_password(length: int = 10) -> str:
    """Random, readable temporary password (letters + digits, no ambiguous chars)."""
    import secrets as _secrets
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    return "".join(_secrets.choice(alphabet) for _ in range(length))


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: UUID,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin resets a forgotten password for any account — generates a new
    temporary password, shown once in this response, and forces the user to
    change it on next login."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    temp_password = _generate_temp_password()
    user.hashed_password = _pwd.hash(temp_password)
    user.must_change_password = True
    await db.commit()
    return {"user_id": str(user.id), "temporary_password": temp_password}


@router.delete("/users/{user_id}/subscription")
async def cancel_subscription(
    user_id: UUID,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.plan = SubscriptionPlan.FREE
    user.subscription_expires_at = None
    return {"message": "Subscription cancelled"}


@router.get("/settings")
async def get_settings(_: User = Depends(get_admin_user)):
    return {
        "ai_model": _dynamic_settings.get("ai_model", settings.AI_MODEL),
        "rag_top_k": _dynamic_settings.get("rag_top_k", settings.RAG_TOP_K),
        "free_pages_limit": _dynamic_settings.get("free_pages_limit", settings.FREE_PAGES_LIMIT),
        "free_questions_per_day": _dynamic_settings.get("free_questions_per_day", settings.FREE_QUESTIONS_PER_DAY),
        "free_summaries_per_month": _dynamic_settings.get("free_summaries_per_month", settings.FREE_SUMMARIES_PER_MONTH),
        "monthly_price_usd": _dynamic_settings.get("monthly_price_usd", 9.99),
        "yearly_price_usd": _dynamic_settings.get("yearly_price_usd", 79.99),
    }


@router.patch("/settings")
async def update_settings(
    body: AdminSettings,
    _: User = Depends(get_admin_user)
):
    """Admin can change AI model, quotas, prices without redeployment."""
    updates = body.model_dump(exclude_none=True)
    _dynamic_settings.update(updates)
    return {"message": "Settings updated", "current": _dynamic_settings}


# ── Teacher Management ────────────────────────────────────────

def _serialize_teacher(t: User) -> dict:
    features = t.teacher_features or {}
    student_count = 0  # filled by caller if needed
    return {
        "id": str(t.id),
        "full_name": t.full_name,
        "email": t.email,
        "status": t.status.value,
        "suspension_reason": t.suspension_reason,
        "teacher_code": t.teacher_code,
        "features": {flag: features.get(flag, False) for flag in TEACHER_FEATURE_FLAGS},
        "created_at": t.created_at.isoformat(),
    }


@router.get("/teachers")
async def list_teachers(
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List all teachers with their feature flags and student counts."""
    r = await db.execute(
        select(User).where(User.role == UserRole.TEACHER).order_by(User.created_at.desc())
    )
    teachers = r.scalars().all()
    # Attach student counts
    result = []
    for t in teachers:
        cr = await db.scalar(
            select(func.count(User.id)).where(User.teacher_id == t.id)
        )
        info = _serialize_teacher(t)
        info["student_count"] = cr or 0
        result.append(info)
    return result


class CreateTeacherRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    features: Optional[dict] = None   # {flag: bool}


@router.post("/teachers")
async def create_teacher(
    body: CreateTeacherRequest,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin creates a teacher account directly (no approval needed)."""
    # Check email uniqueness
    ex = await db.execute(select(User).where(User.email == body.email))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مستخدم بالفعل")

    # Build validated features dict
    features = {flag: bool(body.features.get(flag, False)) for flag in TEACHER_FEATURE_FLAGS} \
        if body.features else {flag: False for flag in TEACHER_FEATURE_FLAGS}

    # Generate teacher code
    import random, string
    code = "T-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

    teacher = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=_pwd.hash(body.password),
        role=UserRole.TEACHER,
        status=AccountStatus.ACTIVE,
        teacher_code=code,
        teacher_features=features,
    )
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)
    info = _serialize_teacher(teacher)
    info["student_count"] = 0
    return info


class TeacherFeaturesRequest(BaseModel):
    features: dict   # {flag: bool}


@router.patch("/teachers/{teacher_id}/features")
async def update_teacher_features(
    teacher_id: UUID,
    body: TeacherFeaturesRequest,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin sets which feature flags a teacher has access to."""
    r = await db.execute(select(User).where(User.id == teacher_id, User.role == UserRole.TEACHER))
    teacher = r.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="معلم غير موجود")
    # Merge only known flags — build a NEW dict so SQLAlchemy detects the change
    # (mutating the existing JSON dict in place would leave the column looking
    # unchanged to the ORM's dirty-tracking, and the update would silently be lost)
    existing = dict(teacher.teacher_features or {})
    for flag in TEACHER_FEATURE_FLAGS:
        if flag in body.features:
            existing[flag] = bool(body.features[flag])
    teacher.teacher_features = existing
    await db.commit()
    return _serialize_teacher(teacher)


@router.patch("/teachers/{teacher_id}/status")
async def update_teacher_status(
    teacher_id: UUID,
    body: AdminUserUpdate,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin activates/suspends a teacher."""
    r = await db.execute(select(User).where(User.id == teacher_id, User.role == UserRole.TEACHER))
    teacher = r.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="معلم غير موجود")
    if body.status is not None:
        teacher.status = body.status
        if body.status != AccountStatus.SUSPENDED:
            teacher.suspension_reason = None
    await db.commit()
    return _serialize_teacher(teacher)


@router.delete("/teachers/{teacher_id}")
async def delete_teacher(
    teacher_id: UUID,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin deletes a teacher (students become unlinked, not deleted)."""
    r = await db.execute(select(User).where(User.id == teacher_id, User.role == UserRole.TEACHER))
    teacher = r.scalar_one_or_none()
    if not teacher:
        raise HTTPException(status_code=404, detail="معلم غير موجود")
    # Unlink students
    students_r = await db.execute(select(User).where(User.teacher_id == teacher_id))
    for student in students_r.scalars().all():
        student.teacher_id = None
    await db.delete(teacher)
    await db.commit()
    return {"message": "تم حذف المعلم وإلغاء ربط طلابه"}


@router.get("/curricula")
async def list_all_curricula(
    search: str | None = Query(None),
    skip: int = 0,
    limit: int = 100,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin views every curriculum on the platform, regardless of owner."""
    q = select(Curriculum, User).join(User, Curriculum.owner_id == User.id).order_by(Curriculum.created_at.desc())
    if search:
        like = f"%{search}%"
        q = q.where(Curriculum.title.ilike(like) | User.full_name.ilike(like) | User.email.ilike(like))
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    rows = result.all()
    return [{
        "id": str(c.id),
        "title": c.title,
        "subject": c.subject,
        "grade_level": c.grade_level,
        "status": c.status.value,
        "total_pages": c.total_pages,
        "created_at": c.created_at.isoformat(),
        "owner": {"id": str(owner.id), "full_name": owner.full_name, "email": owner.email, "role": owner.role.value},
    } for c, owner in rows]


@router.delete("/curricula/{curriculum_id}")
async def delete_curriculum(
    curriculum_id: UUID,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin removes a curriculum from the platform."""
    r = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    curriculum = r.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="المنهج غير موجود")
    await db.delete(curriculum)
    await db.commit()
    return {"message": "تم حذف المنهج"}


@router.get("/teachers/{teacher_id}/students")
async def teacher_students(
    teacher_id: UUID,
    _: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin views all students belonging to a teacher."""
    r = await db.execute(
        select(User).where(User.teacher_id == teacher_id, User.role == UserRole.STUDENT).order_by(User.full_name)
    )
    return [{
        "id": str(s.id),
        "full_name": s.full_name,
        "email": s.email,
        "status": s.status.value,
        "plan": s.plan.value,
        "ai_assist_enabled": s.ai_assist_enabled,
        "created_at": s.created_at.isoformat(),
    } for s in r.scalars().all()]

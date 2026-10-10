"""Teacher portal — view students, grade open questions, approve/reject attempts."""
import uuid
import re
import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole, AccountStatus
from app.models.curriculum import Curriculum
from app.models.exam import QuizAttempt, TeacherEvaluation, AttemptStatus, ExamTypeConfig, ExamType
from app.middleware.auth import get_current_user, hash_password
from app.services.notification_service import notify

from app.services.ai_client import client as _ai_client

router = APIRouter(prefix="/teacher", tags=["Teacher"])


def _require_teacher(current_user: User):
    if current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")
    return current_user


# ── Students ─────────────────────────────────────────────────

@router.get("/students")
async def list_students(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all students linked to this teacher."""
    _require_teacher(current_user)
    r = await db.execute(
        select(User).where(
            User.teacher_id == current_user.id,
            User.role == UserRole.STUDENT
        ).order_by(User.full_name)
    )
    students = r.scalars().all()
    return [_serialize_student(s) for s in students]


def _generate_default_password(full_name: str) -> str:
    """Default temp password: student's first name + current year (e.g. 'ahmed2026').
    Predictable by design (easy for a teacher to hand out verbally), which is why
    accounts created this way are always flagged must_change_password=True."""
    first_name = (full_name or "").strip().split()[0] if (full_name or "").strip() else "student"
    slug = re.sub(r"[^\w]", "", first_name).lower() or "student"
    year = datetime.utcnow().year
    return f"{slug}{year}"


class CreateStudentRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str


@router.post("/students", status_code=201)
async def create_student(
    body: CreateStudentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teacher creates a student account directly with a system-generated
    temporary password. The plaintext password is returned ONLY in this
    response — it is never stored or retrievable again, so the teacher must
    copy it now and hand it to the student."""
    _require_teacher(current_user)

    ex = await db.execute(select(User).where(User.email == body.email.lower()))
    if ex.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="البريد الإلكتروني مستخدم بالفعل")
    ex_phone = await db.execute(select(User).where(User.phone == body.phone))
    if ex_phone.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="رقم التليفون مستخدم بالفعل")

    student_code = None
    if current_user.teacher_code:
        from sqlalchemy import func
        count = await db.scalar(
            select(func.count(User.id)).where(User.teacher_id == current_user.id)
        )
        student_code = f"{current_user.teacher_code}-{(count or 0) + 1:02d}"

    temp_password = _generate_default_password(body.full_name)
    student = User(
        email=body.email.lower(),
        phone=body.phone,
        full_name=body.full_name,
        hashed_password=hash_password(temp_password),
        role=UserRole.STUDENT,
        status=AccountStatus.ACTIVE,
        teacher_id=current_user.id,
        student_code=student_code,
        must_change_password=True,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    return {
        **_serialize_student(student),
        "temporary_password": temp_password,
    }


@router.post("/students/{student_id}/reset-password")
async def reset_student_password(
    student_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teacher resets a forgotten password for one of their own students —
    generates a new temporary password, shown once in this response, and
    forces the student to change it on next login."""
    _require_teacher(current_user)
    r = await db.execute(select(User).where(User.id == student_id))
    student = r.scalar_one_or_none()
    if not student or (student.teacher_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="طالب غير موجود")

    temp_password = _generate_default_password(student.full_name)
    student.hashed_password = hash_password(temp_password)
    student.must_change_password = True
    await db.commit()
    return {"student_id": str(student.id), "temporary_password": temp_password}


@router.patch("/students/{student_id}/ai-assist")
async def toggle_student_ai_assist(
    student_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable AI exam assist for a specific student. Teacher must have the feature granted by admin."""
    _require_teacher(current_user)
    # Check teacher has permission to grant AI assist
    features = current_user.teacher_features or {}
    if not features.get("can_grant_ai_assist", False) and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية تفعيل مساعد الذكاء الاصطناعي للطلاب. تواصل مع الآدمن.")

    r = await db.execute(select(User).where(User.id == student_id))
    student = r.scalar_one_or_none()
    if not student or (student.teacher_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="طالب غير موجود")

    student.ai_assist_enabled = not student.ai_assist_enabled
    await db.commit()
    return {"student_id": str(student.id), "ai_assist_enabled": student.ai_assist_enabled}


def _serialize_student(s: User) -> dict:
    return {
        "id": str(s.id),
        "full_name": s.full_name,
        "email": s.email,
        "phone": s.phone,
        "student_code": s.student_code,
        "status": s.status.value,
        "plan": s.plan.value,
        "ai_assist_enabled": s.ai_assist_enabled,
        "created_at": s.created_at.isoformat(),
    }


@router.get("/students/{student_id}/attempts")
async def student_attempts(
    student_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all quiz attempts for a specific student."""
    _require_teacher(current_user)

    # Verify student belongs to this teacher
    r = await db.execute(select(User).where(User.id == student_id))
    student = r.scalar_one_or_none()
    if not student or (student.teacher_id != current_user.id and current_user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Student not found")

    r = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.student_id == student_id)
        .order_by(QuizAttempt.started_at.desc())
    )
    attempts = r.scalars().all()
    from app.models.activity import Activity, ActivityAttempt
    act_rows = (await db.execute(
        select(ActivityAttempt, Activity.title)
        .join(Activity, Activity.id == ActivityAttempt.activity_id)
        .where(ActivityAttempt.user_id == student_id, Activity.owner_id == student.teacher_id)
        .order_by(ActivityAttempt.created_at.desc())
    )).all()
    return {
        "student": {"id": str(student.id), "full_name": student.full_name},
        "activity_attempts": [{
            "activity_id": str(att.activity_id), "title": title, "template": att.template,
            "score": att.score, "correct": att.correct, "total": att.total,
            "pct": round(100 * att.correct / att.total) if att.total else 0,
            "duration_sec": round(att.duration_sec, 1), "at": att.created_at.isoformat(),
        } for att, title in act_rows],
        "attempts": [{
            "attempt_id": str(a.id),
            "exam_type": a.exam_type.value,
            "status": a.status.value,
            "total_score": a.total_score,
            "max_score": a.max_score,
            "percentage": a.percentage,
            "passed": a.passed,
            "auto_score": a.auto_score,
            "manual_score": a.manual_score,
            "started_at": a.started_at.isoformat(),
            "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        } for a in attempts]
    }


# ── Channel links ────────────────────────────────────────────

class ChannelLink(BaseModel):
    label: str
    url: str


class ChannelLinksRequest(BaseModel):
    links: list[ChannelLink]


@router.patch("/channel-links")
async def update_channel_links(
    body: ChannelLinksRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teacher publishes/updates links to their own educational channels.
    Requires the 'can_add_channel_links' feature flag granted by an admin."""
    _require_teacher(current_user)
    features = current_user.teacher_features or {}
    if not features.get("can_add_channel_links", False) and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية إضافة روابط قنوات. تواصل مع الآدمن.")

    current_user.channel_links = [link.model_dump() for link in body.links]
    await db.commit()
    return {"channel_links": current_user.channel_links}


# ── Pending reviews ───────────────────────────────────────────

@router.get("/pending")
async def pending_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all attempts from this teacher's students that need review."""
    _require_teacher(current_user)
    r = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.teacher_id == current_user.id,
            QuizAttempt.status.in_([AttemptStatus.SUBMITTED, AttemptStatus.NEEDS_REVIEW])
        ).order_by(QuizAttempt.submitted_at.desc())
    )
    attempts = r.scalars().all()

    # Fetch student names
    student_ids = list({a.student_id for a in attempts})
    students_map = {}
    if student_ids:
        rs = await db.execute(select(User).where(User.id.in_(student_ids)))
        for s in rs.scalars().all():
            students_map[s.id] = s.full_name

    return [{
        "attempt_id": str(a.id),
        "student_id": str(a.student_id),
        "student_name": students_map.get(a.student_id, "—"),
        "exam_type": a.exam_type.value,
        "status": a.status.value,
        "auto_score": a.auto_score,
        "max_score": a.max_score,
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "needs_manual": a.status == AttemptStatus.NEEDS_REVIEW,
    } for a in attempts]


@router.get("/attempt/{attempt_id}")
async def get_attempt_detail(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Full attempt detail — questions, student answers, auto-grading results."""
    _require_teacher(current_user)
    r = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.teacher_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Student info
    rs = await db.execute(select(User).where(User.id == attempt.student_id))
    student = rs.scalar_one_or_none()

    return {
        "attempt_id": str(attempt.id),
        "student": {"id": str(student.id), "full_name": student.full_name} if student else None,
        "exam_type": attempt.exam_type.value,
        "status": attempt.status.value,
        "config": attempt.config,
        "questions": attempt.questions,
        "answers": attempt.answers,
        "question_results": attempt.question_results,
        "auto_score": attempt.auto_score,
        "manual_score": attempt.manual_score,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "time_taken_seconds": attempt.time_taken_seconds,
        "started_at": attempt.started_at.isoformat(),
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    }


# ── Evaluate / Grade ──────────────────────────────────────────

class EvaluateRequest(BaseModel):
    # {question_index: points_given}  — only needed for open questions
    manual_grades: dict[str, float] = {}
    comment: str | None = None
    final_grade_override: float | None = None
    # "approved" | "rejected" | "needs_revision"
    decision: str = "approved"


@router.post("/attempt/{attempt_id}/evaluate")
async def evaluate_attempt(
    attempt_id: uuid.UUID,
    body: EvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher grades any open questions and can also correct an individual
    auto-graded question's score — manual_grades applies to any question
    index present in it, not just ones flagged needs_manual — then
    approves/rejects the attempt."""
    _require_teacher(current_user)

    r = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.teacher_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Apply grade overrides to question_results — works for any question,
    # not just ones needing manual review, so a teacher can also correct a
    # specific auto-graded question they disagree with.
    updated_results = attempt.question_results or []
    for res in updated_results:
        idx_str = str(res["q_index"])
        if idx_str in body.manual_grades:
            pts = float(body.manual_grades[idx_str])
            pts = max(0.0, min(pts, res["max_points"]))
            res["points_earned"] = pts
            res["is_correct"] = pts >= res["max_points"]
            res["needs_manual"] = False

    attempt.question_results = updated_results
    attempt.total_score = sum(r.get("points_earned") or 0 for r in updated_results)
    attempt.manual_score = attempt.total_score - (attempt.auto_score or 0)

    if body.final_grade_override is not None:
        attempt.total_score = body.final_grade_override

    if attempt.max_score:
        attempt.percentage = round(attempt.total_score / attempt.max_score * 100, 1)
        attempt.passed = attempt.percentage >= attempt.config.get("pass_threshold", 60.0)

    attempt.status = {
        "approved": AttemptStatus.APPROVED,
        "rejected": AttemptStatus.REJECTED,
    }.get(body.decision, AttemptStatus.SUBMITTED)

    # Upsert TeacherEvaluation record
    ev_r = await db.execute(select(TeacherEvaluation).where(TeacherEvaluation.attempt_id == attempt_id))
    evaluation = ev_r.scalar_one_or_none()
    if evaluation:
        evaluation.manual_grades = body.manual_grades
        evaluation.comment = body.comment
        evaluation.final_grade_override = body.final_grade_override
        evaluation.status = body.decision
        evaluation.evaluated_at = datetime.utcnow()
        evaluation.teacher_id = current_user.id
    else:
        evaluation = TeacherEvaluation(
            attempt_id=attempt_id,
            teacher_id=current_user.id,
            manual_grades=body.manual_grades,
            comment=body.comment,
            final_grade_override=body.final_grade_override,
            status=body.decision,
        )
        db.add(evaluation)

    # Notify student
    decision_labels = {
        "approved": "✅ تمت الموافقة على اختبارك",
        "rejected": "❌ تم رفض اختبارك",
        "needs_revision": "✏️ اختبارك يحتاج مراجعة",
    }
    notif_title = decision_labels.get(body.decision, "تم تقييم اختبارك")
    score_text = f"درجتك: {attempt.total_score:.1f} / {attempt.max_score:.1f} ({attempt.percentage}%)" if attempt.percentage else ""
    await notify(
        db,
        user_id=attempt.student_id,
        title=notif_title,
        body=score_text + (f"\n{body.comment}" if body.comment else ""),
        notif_type=f"exam_{body.decision}",
        link=f"/dashboard/grades/{attempt.id}",
    )

    await db.commit()
    return {
        "message": "تم التقييم بنجاح",
        "attempt_id": str(attempt_id),
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "status": attempt.status.value,
    }


# ── AI Grading Suggestion ─────────────────────────────────────

@router.post("/attempt/{attempt_id}/ai-suggest")
async def ai_suggest_grades(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Use AI to suggest grades for questions still awaiting manual review in
    an attempt — always essay, plus any other type whose source had no known
    correct answer to auto-grade against (e.g. extracted from an exam paper
    that never printed one)."""
    _require_teacher(current_user)

    r = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.teacher_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    open_results = [
        r for r in (attempt.question_results or [])
        if r.get("needs_manual")
    ]
    if not open_results:
        return {"suggestions": {}}

    suggestions = {}
    for res in open_results:
        q_index = res["q_index"]
        question_text = (attempt.questions or [])[q_index].get("question", "") if q_index < len(attempt.questions or []) else ""
        options = res.get("options") or []
        student_answer = res.get("student_answer", "").strip()
        model_answer = res.get("correct_answer", "").strip()
        max_pts = res.get("max_points", 5)

        if not student_answer:
            suggestions[str(q_index)] = {"suggested_points": 0.0, "reasoning": "لم يُجب الطالب على هذا السؤال"}
            continue

        options_line = f"\nالخيارات: {', '.join(options)}\n" if options else ""

        prompt = f"""أنت معلم خبير تصحح إجابات الطلاب.

السؤال: {question_text}
{options_line}
الإجابة النموذجية: {model_answer or "غير متوفرة — احكم بنفسك بناءً على معرفتك الصحيحة بالمادة"}

إجابة الطالب: {student_answer}

الدرجة القصوى: {max_pts}

قيّم إجابة الطالب وأعطِ:
1. درجة مقترحة (رقم من 0 إلى {max_pts})
2. تبرير مختصر للدرجة (جملة أو جملتان بالعربية)

أجب بهذا التنسيق بالضبط:
SCORE: [الرقم]
REASON: [التبرير]"""

        try:
            resp = await _ai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.2,
            )
            text = resp.choices[0].message.content.strip()
            score_line = next((l for l in text.splitlines() if l.startswith("SCORE:")), "")
            reason_line = next((l for l in text.splitlines() if l.startswith("REASON:")), "")
            score_str = score_line.replace("SCORE:", "").strip()
            reasoning = reason_line.replace("REASON:", "").strip()
            try:
                score = float(score_str)
                score = max(0.0, min(score, float(max_pts)))
            except ValueError:
                score = max_pts / 2

            suggestions[str(q_index)] = {
                "suggested_points": round(score, 1),
                "reasoning": reasoning or "الإجابة مقبولة",
            }
        except Exception:
            suggestions[str(q_index)] = {
                "suggested_points": round(max_pts / 2, 1),
                "reasoning": "تعذّر الاتصال بالذكاء الاصطناعي — يُقترح منتصف الدرجة",
            }

    return {"suggestions": suggestions}


# ── Exam Type Config ────────────────────────────────────────────
# Global defaults (curriculum_id=None) are admin-only. A teacher may create
# or edit an override scoped to one of their own curricula.

@router.get("/exam-configs")
async def list_exam_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List exam type configurations — global defaults plus, for a teacher,
    only the per-curriculum overrides on curricula they own (admin sees all)."""
    _require_teacher(current_user)
    q = select(ExamTypeConfig).order_by(ExamTypeConfig.exam_type)
    if current_user.role != UserRole.ADMIN:
        owned = await db.execute(select(Curriculum.id).where(Curriculum.owner_id == current_user.id))
        owned_ids = [row[0] for row in owned.all()]
        q = q.where((ExamTypeConfig.curriculum_id == None) | (ExamTypeConfig.curriculum_id.in_(owned_ids)))
    r = await db.execute(q)
    configs = r.scalars().all()
    return [{
        "id": str(c.id),
        "exam_type": c.exam_type.value,
        "curriculum_id": str(c.curriculum_id) if c.curriculum_id else None,
        "time_limit_minutes": c.time_limit_minutes,
        "mcq_count": c.mcq_count,
        "true_false_count": c.true_false_count,
        "fill_blank_count": c.fill_blank_count,
        "why_count": c.why_count,
        "essay_count": c.essay_count,
        "mcq_points": c.mcq_points,
        "true_false_points": c.true_false_points,
        "fill_blank_points": c.fill_blank_points,
        "why_points": c.why_points,
        "essay_points": c.essay_points,
        "pass_threshold": c.pass_threshold,
        "difficulty": c.difficulty,
    } for c in configs]


class ExamConfigUpdate(BaseModel):
    exam_type: ExamType
    curriculum_id: uuid.UUID | None = None
    time_limit_minutes: int = 30
    mcq_count: int = 10
    true_false_count: int = 5
    fill_blank_count: int = 3
    why_count: int = 2
    essay_count: int = 0
    mcq_points: float = 2.0
    true_false_points: float = 1.0
    fill_blank_points: float = 2.0
    why_points: float = 5.0
    essay_points: float = 10.0
    pass_threshold: float = 60.0
    difficulty: str = "medium"


@router.put("/exam-configs")
async def upsert_exam_config(
    body: ExamConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Admin creates or updates any exam type config, including the global
    default (curriculum_id=None). A teacher may only create/update an
    override scoped to a curriculum they own."""
    _require_teacher(current_user)
    if current_user.role != UserRole.ADMIN:
        if body.curriculum_id is None:
            raise HTTPException(status_code=403, detail="Only admins can edit the global default")
        owns = await db.execute(
            select(Curriculum.id).where(
                Curriculum.id == body.curriculum_id, Curriculum.owner_id == current_user.id
            )
        )
        if not owns.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Curriculum not found")

    r = await db.execute(
        select(ExamTypeConfig).where(
            ExamTypeConfig.exam_type == body.exam_type,
            ExamTypeConfig.curriculum_id == body.curriculum_id
        )
    )
    config = r.scalar_one_or_none()
    if config:
        for field, val in body.model_dump(exclude={"exam_type", "curriculum_id"}).items():
            setattr(config, field, val)
    else:
        config = ExamTypeConfig(**body.model_dump())
        db.add(config)

    await db.commit()
    return {"message": "تم حفظ الإعدادات", "exam_type": body.exam_type.value}

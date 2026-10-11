"""Games & activities (Wordwall/Quizizz/Blooket/Baamboozle-style) and
spaced-repetition flashcard study (Quizlet-style)."""
import re
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, get_optional_user, check_quota, hash_password
from app.models.user import User, UserRole, AccountStatus
from app.models.curriculum import Curriculum, Lesson
from app.models.assignment import StudentGroup
from app.models.activity import Activity, ActivityAttempt, FlashcardReview
from app.services import activity_service, lesson_content
from app.services.notification_service import notify
from app.services import teachers as links

router = APIRouter(prefix="/activities", tags=["Activities"])
study_router = APIRouter(prefix="/study", tags=["Flashcard study"])


def _require_teacher(user: User):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")


def _serialize(a: Activity, user: User | None = None, owner_name: str | None = None) -> dict:
    return {
        "id": str(a.id),
        "title": a.title,
        "description": a.description,
        "subject": a.subject,
        "grade_level": a.grade_level,
        "curriculum_id": str(a.curriculum_id) if a.curriculum_id else None,
        "lesson_id": str(a.lesson_id) if a.lesson_id else None,
        "items": a.items or [],
        "item_count": len(a.items or []),
        "template": a.template,
        "is_public": a.is_public,
        "plays": a.plays,
        "assigned": a.assigned,
        "group_id": str(a.group_id) if a.group_id else None,
        "due_at": a.due_at.isoformat() if a.due_at else None,
        "power_ups": a.power_ups,
        "time_per_question": a.time_per_question,
        "calm_mode": bool(a.calm_mode),
        "game_minutes": a.game_minutes,
        "link_enabled": bool(a.link_enabled),
        "allow_guests": a.allow_guests is not False,
        "leaderboard_visible": a.leaderboard_visible is not False,
        # Only the owner needs the token (to copy the link).
        "share_token": a.share_token if user and a.owner_id == user.id else None,
        "is_owner": bool(user and a.owner_id == user.id),
        "owner_name": owner_name,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


async def _student_can_play(a: Activity, user: User, db: AsyncSession) -> bool:
    if user.role != UserRole.STUDENT or a.owner_id != user.teacher_id or not a.assigned:
        return False
    if a.group_id:
        group = await db.get(StudentGroup, a.group_id)
        return bool(group and str(user.id) in [str(s) for s in (group.student_ids or [])])
    return True


async def _get_activity(activity_id: uuid.UUID, user: User, db: AsyncSession, manage: bool = False) -> Activity:
    a = await db.get(Activity, activity_id)
    if not a:
        raise HTTPException(status_code=404, detail="Activity not found")
    if a.owner_id == user.id or user.role == UserRole.ADMIN:
        return a
    if not manage and (a.is_public or await _student_can_play(a, user, db)):
        return a
    raise HTTPException(status_code=404, detail="Activity not found")


async def _owned_curriculum(curriculum_id: uuid.UUID | None, user: User, db: AsyncSession) -> Curriculum | None:
    if not curriculum_id:
        return None
    c = await db.get(Curriculum, curriculum_id)
    if not c or (c.owner_id != user.id and user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return c


# ── Listing ──────────────────────────────────────────────────

@router.get("/")
async def my_activities(lesson_id: uuid.UUID | None = None, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Teachers: their own activities. Students: what's assigned to them."""
    if user.role == UserRole.STUDENT:
        q = select(Activity).where(Activity.owner_id == user.teacher_id, Activity.assigned.is_(True))
    else:
        q = select(Activity).where(Activity.owner_id == user.id)
    if lesson_id:
        q = q.where(Activity.lesson_id == lesson_id)
    rows = (await db.execute(q.order_by(Activity.created_at.desc()))).scalars().all()
    if user.role == UserRole.STUDENT:
        rows = [a for a in rows if await _student_can_play(a, user, db)]
        done = {
            r[0]: r[1] for r in (await db.execute(
                select(ActivityAttempt.activity_id, func.max(ActivityAttempt.score))
                .where(ActivityAttempt.user_id == user.id).group_by(ActivityAttempt.activity_id)
            )).all()
        }
        return [{**_serialize(a, user), "items": [], "best_score": done.get(a.id)} for a in rows]
    return [{**_serialize(a, user), "items": []} for a in rows]


@router.get("/library")
async def library(q: str = "", user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The public library — activities teachers chose to share."""
    stmt = select(Activity, User.full_name).join(User, User.id == Activity.owner_id).where(Activity.is_public.is_(True))
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Activity.title.ilike(like), Activity.subject.ilike(like), Activity.grade_level.ilike(like)))
    rows = (await db.execute(stmt.order_by(Activity.plays.desc(), Activity.created_at.desc()).limit(60))).all()
    return [{**_serialize(a, user, name), "items": []} for a, name in rows]


@router.get("/templates")
async def templates(user: User = Depends(get_current_user)):
    return {"templates": sorted(activity_service.TEMPLATES)}


# ── Create / generate ────────────────────────────────────────

class ActivityBody(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    grade_level: str | None = None
    curriculum_id: uuid.UUID | None = None
    lesson_id: uuid.UUID | None = None
    items: list[dict] | None = None
    template: str | None = None
    is_public: bool | None = None
    assigned: bool | None = None
    group_id: uuid.UUID | None = None
    due_at: datetime | None = None
    power_ups: bool | None = None
    time_per_question: int | None = None
    calm_mode: bool | None = None
    game_minutes: int | None = None
    link_enabled: bool | None = None
    allow_guests: bool | None = None
    leaderboard_visible: bool | None = None


def _apply(a: Activity, body: ActivityBody, fields: set[str]) -> None:
    if "title" in fields and body.title and body.title.strip():
        a.title = body.title.strip()[:300]
    for name in ("description", "subject", "grade_level"):
        if name in fields:
            setattr(a, name, (getattr(body, name) or "").strip() or None)
    if "items" in fields and body.items is not None:
        a.items = activity_service.clean_items(body.items)
    if "template" in fields and body.template in activity_service.TEMPLATES:
        a.template = body.template
    for name in ("is_public", "assigned", "power_ups", "calm_mode", "link_enabled", "allow_guests", "leaderboard_visible"):
        if name in fields and getattr(body, name) is not None:
            setattr(a, name, getattr(body, name))
    if "group_id" in fields:
        a.group_id = body.group_id
    if "due_at" in fields:
        a.due_at = body.due_at
    if a.link_enabled and not a.share_token:
        a.share_token = secrets.token_urlsafe(9)
    if "game_minutes" in fields:
        a.game_minutes = min(max(body.game_minutes, 1), 60) if body.game_minutes else None
    if "time_per_question" in fields and body.time_per_question:
        a.time_per_question = min(max(body.time_per_question, 5), 120)


@router.post("/", status_code=201)
async def create_activity(body: ActivityBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_teacher(user)
    curriculum = await _owned_curriculum(body.curriculum_id, user, db)
    lesson = await db.get(Lesson, body.lesson_id) if body.lesson_id else None
    if lesson and (not curriculum or lesson.curriculum_id != curriculum.id):
        raise HTTPException(status_code=400, detail="Lesson doesn't belong to the curriculum")
    a = Activity(
        owner_id=user.id, curriculum_id=curriculum.id if curriculum else None, lesson_id=lesson.id if lesson else None,
        title=(body.title or (lesson.title if lesson else "")).strip() or "نشاط جديد",
        subject=curriculum.subject if curriculum else None, grade_level=curriculum.grade_level if curriculum else None,
        items=[],
    )
    _apply(a, body, body.model_fields_set - {"title"})
    if body.group_id:
        await _check_group(body.group_id, user, db)
    db.add(a)
    await db.commit()
    return _serialize(a, user)


class GenerateBody(BaseModel):
    curriculum_id: uuid.UUID
    lesson_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    count: int = 12
    source_text: str | None = None


@router.post("/generate")
async def generate_items(body: GenerateBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """AI-written items from the lesson text (returned for review, not saved)."""
    _require_teacher(user)
    check_quota(user, "questions")
    curriculum = await _owned_curriculum(body.curriculum_id, user, db)
    lesson = await db.get(Lesson, body.lesson_id) if body.lesson_id else None
    content = await lesson_content.generation_text(db, curriculum, body.lesson_id, body.unit_id, body.source_text)
    if not content:
        raise HTTPException(status_code=422, detail="لم يتم العثور على نص لهذا الدرس")
    items = await activity_service.generate_items(content, min(max(body.count, 4), 40), lesson.title if lesson else curriculum.title)
    if not items:
        raise HTTPException(status_code=502, detail="فشل توليد الأسئلة، حاول تاني")
    user.questions_generated_today = (user.questions_generated_today or 0) + 1
    await db.commit()
    return {"items": items}


@router.get("/from-flashcards/{lesson_id}")
async def items_from_flashcards(lesson_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The lesson's cached flashcards as activity items."""
    _require_teacher(user)
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await _owned_curriculum(lesson.curriculum_id, user, db)
    return {"items": activity_service.clean_items(lesson.flashcards or [])}


async def _check_group(group_id: uuid.UUID, user: User, db: AsyncSession) -> None:
    g = await db.get(StudentGroup, group_id)
    if not g or g.teacher_id != user.id:
        raise HTTPException(status_code=404, detail="Group not found")


# ── Share link (anyone with the link, as the teacher allows) ─

async def _shared_activity(token: str, user: User | None, db: AsyncSession) -> Activity:
    a = (await db.execute(select(Activity).where(Activity.share_token == token))).scalar_one_or_none()
    if not a or not a.link_enabled:
        raise HTTPException(status_code=404, detail="الرابط ده مش متاح — اسأل المدرس")
    if a.allow_guests is False and not (
        user and (user.id == a.owner_id or user.role == UserRole.ADMIN or await links.is_student_of(db, a.owner_id, user.id))
    ):
        raise HTTPException(status_code=403, detail="النشاط ده لطلاب المدرس المسجلين بس — سجّل دخولك الأول")
    return a


@router.get("/shared/{token}")
async def get_shared(token: str, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    a = await _shared_activity(token, user, db)
    owner = await db.get(User, a.owner_id)
    return {**_serialize(a, user, owner.full_name if owner else None), "signed_in_as": user.full_name if user else None}


def _digits(phone: str | None) -> str:
    return re.sub(r"\D", "", phone or "")


async def _registered_student(a: Activity, phone: str, db: AsyncSession) -> User | None:
    """The activity owner's own student with this phone number, if any."""
    d = _digits(phone)
    if not d:
        return None
    students = (await db.execute(
        select(User).where(links.students_of(a.owner_id), User.role == UserRole.STUDENT, User.phone.is_not(None))
    )).scalars().all()
    return next((s for s in students if _digits(s.phone) == d), None)


class GuestCheckBody(BaseModel):
    phone: str


@router.post("/shared/{token}/check-guest")
async def check_guest(token: str, body: GuestCheckBody, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    """Sign-up screen: is this phone already one of the teacher's students?
    Then they must sign in, so the result lands in their own record (and
    nobody can submit under a registered student's name)."""
    a = await _shared_activity(token, user, db)
    if not 8 <= len(_digits(body.phone)) <= 15:
        raise HTTPException(status_code=422, detail="اكتب رقم موبايل صحيح")
    return {"registered": await _registered_student(a, body.phone, db) is not None}


class SharedAttemptBody(BaseModel):
    template: str
    score: int = 0
    correct: int = 0
    total: int = 0
    duration_sec: float = 0
    answers: list[dict] = []
    guest_name: str | None = None
    guest_key: str | None = None
    guest_phone: str | None = None
    guest_class: str | None = None


@router.post("/shared/{token}/attempts", status_code=201)
async def save_shared_attempt(token: str, body: SharedAttemptBody, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    a = await _shared_activity(token, user, db)
    if user:
        await _record_attempt(a, body, db, user=user)
        return {"message": "saved"}
    guest_name = (body.guest_name or "").strip()[:40]
    phone = _digits(body.guest_phone)
    if not guest_name or not 8 <= len(phone) <= 15:
        raise HTTPException(status_code=422, detail="اكتب اسمك ورقم موبايلك الأول")
    if await _registered_student(a, phone, db):
        raise HTTPException(status_code=409, detail="الرقم ده مسجّل لطالب عند المدرس — سجّل دخولك عشان النتيجة تتسجل في سجلك")
    await _record_attempt(
        a, body, db, user=None, guest_name=guest_name, guest_key=(body.guest_key or "")[:64] or None,
        guest_phone=phone, guest_class=(body.guest_class or "").strip()[:100] or None,
    )
    return {"message": "saved"}


@router.get("/shared/{token}/leaderboard")
async def shared_leaderboard(token: str, guest_key: str | None = None, user: User | None = Depends(get_optional_user), db: AsyncSession = Depends(get_db)):
    a = await _shared_activity(token, user, db)
    if a.leaderboard_visible is False and not (user and user.id == a.owner_id):
        raise HTTPException(status_code=403, detail="المدرس مخبّي الترتيب")
    return await _leaderboard(a, db, user, guest_key)


# Only templates that actually check answers count towards the ranking —
# flashcards are self-assessed, gold quest/tower scores depend on luck or
# their own scale, the wheel/team board aren't individual.
RANKED_TEMPLATES = {"quiz", "truefalse", "match", "anagram", "crossword", "spellit", "live"}


async def _leaderboard(a: Activity, db: AsyncSession, me: User | None, guest_key: str | None = None) -> dict:
    """Each participant's best ranked attempt — higher share of correct answers
    first, then the faster time, then more points (points differ in scale
    between games, the percentage and time don't)."""
    rows = (await db.execute(
        select(ActivityAttempt, User.full_name).outerjoin(User, User.id == ActivityAttempt.user_id)
        .where(ActivityAttempt.activity_id == a.id, ActivityAttempt.template.in_(RANKED_TEMPLATES))
    )).all()
    best: dict[str, tuple] = {}
    for att, name in rows:
        key = f"u:{att.user_id}" if att.user_id else f"g:{att.guest_phone or att.guest_key or att.guest_name}"
        pct = att.correct / att.total if att.total else 0
        rank_key = (-pct, att.duration_sec, -att.score)
        if key not in best or rank_key < best[key][0]:
            best[key] = (rank_key, att, name)
    ordered = sorted(best.values(), key=lambda x: x[0])
    entries = []
    for pos, (_, att, name) in enumerate(ordered, start=1):
        is_me = bool((me and att.user_id == me.id) or (guest_key and att.guest_key == guest_key))
        entries.append({
            "rank": pos, "name": name or att.guest_name or "—", "guest": att.user_id is None,
            "score": att.score, "correct": att.correct, "total": att.total,
            "pct": round(100 * att.correct / att.total) if att.total else 0,
            "duration_sec": round(att.duration_sec, 1), "me": is_me,
        })
    return {"title": a.title, "entries": entries[:100], "me": next((e for e in entries if e["me"]), None), "players": len(entries)}


# ── One activity ─────────────────────────────────────────────

@router.get("/{activity_id}")
async def get_activity(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await _get_activity(activity_id, user, db)
    owner = await db.get(User, a.owner_id)
    return _serialize(a, user, owner.full_name if owner else None)


@router.patch("/{activity_id}")
async def update_activity(activity_id: uuid.UUID, body: ActivityBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_teacher(user)
    a = await _get_activity(activity_id, user, db, manage=True)
    fields = body.model_fields_set
    if "group_id" in fields and body.group_id:
        await _check_group(body.group_id, user, db)
    newly_assigned = "assigned" in fields and body.assigned and not a.assigned
    _apply(a, body, fields)
    await db.commit()
    if newly_assigned:
        await _notify_students(a, user, db)
    return _serialize(a, user)


async def _notify_students(a: Activity, teacher: User, db: AsyncSession) -> None:
    if a.group_id:
        group = await db.get(StudentGroup, a.group_id)
        ids = [uuid.UUID(str(s)) for s in (group.student_ids or [])] if group else []
    else:
        ids = list((await db.execute(select(User.id).where(links.students_of(teacher.id), User.role == UserRole.STUDENT))).scalars().all())
    for sid in ids:
        try:
            await notify(db, user_id=sid, title="🎮 نشاط جديد", body=a.title, link=f"/dashboard/activities/{a.id}")
        except Exception:
            pass
    await db.commit()


@router.delete("/{activity_id}")
async def delete_activity(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_teacher(user)
    a = await _get_activity(activity_id, user, db, manage=True)
    await db.delete(a)
    await db.commit()
    return {"message": "تم حذف النشاط"}


@router.post("/{activity_id}/share/regenerate")
async def regenerate_share_link(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """New link — the old one stops working immediately."""
    _require_teacher(user)
    a = await _get_activity(activity_id, user, db, manage=True)
    a.share_token = secrets.token_urlsafe(9)
    await db.commit()
    return _serialize(a, user)


@router.get("/{activity_id}/leaderboard")
async def activity_leaderboard(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await _get_activity(activity_id, user, db)
    if a.leaderboard_visible is False and a.owner_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="المدرس مخبّي الترتيب")
    return await _leaderboard(a, db, user)


@router.post("/{activity_id}/duplicate", status_code=201)
async def duplicate_activity(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Copy an activity (e.g. from the public library) into my own, to edit."""
    _require_teacher(user)
    src = await _get_activity(activity_id, user, db)
    copy = Activity(
        owner_id=user.id, title=src.title, description=src.description, subject=src.subject,
        grade_level=src.grade_level, items=list(src.items or []), template=src.template,
        copied_from_id=src.id, time_per_question=src.time_per_question, calm_mode=src.calm_mode, game_minutes=src.game_minutes,
    )
    db.add(copy)
    await db.commit()
    return _serialize(copy, user)


# ── Plays & reports ──────────────────────────────────────────

class AttemptBody(BaseModel):
    template: str
    score: int = 0
    correct: int = 0
    total: int = 0
    duration_sec: float = 0
    answers: list[dict] = []


@router.post("/{activity_id}/attempts", status_code=201)
async def save_attempt(activity_id: uuid.UUID, body: AttemptBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await _get_activity(activity_id, user, db)
    await _record_attempt(a, body, db, user=user)
    return {"message": "saved"}


async def _record_attempt(
    a: Activity, body, db: AsyncSession, *, user: User | None,
    guest_name: str | None = None, guest_key: str | None = None,
    guest_phone: str | None = None, guest_class: str | None = None,
) -> None:
    n = len(a.items or [])
    answers = [
        {"i": int(x["i"]), "correct": bool(x.get("correct")), "choice": str(x.get("choice") or "")[:200], "ms": int(x.get("ms") or 0)}
        for x in body.answers if isinstance(x, dict) and str(x.get("i", "")).lstrip("-").isdigit() and 0 <= int(x["i"]) < n
    ][:500]
    db.add(ActivityAttempt(
        activity_id=a.id, user_id=user.id if user else None, guest_name=guest_name, guest_key=guest_key,
        guest_phone=guest_phone, guest_class=guest_class,
        template=body.template[:30],
        score=min(max(0, body.score), 10_000_000), correct=max(0, body.correct), total=max(0, body.total),
        duration_sec=min(max(0.0, body.duration_sec), 86_400.0), answers=answers,
    ))
    a.plays = (a.plays or 0) + 1
    await db.commit()


@router.get("/{activity_id}/report")
async def activity_report(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Per-student results and per-question accuracy (which items the class struggles with)."""
    _require_teacher(user)
    a = await _get_activity(activity_id, user, db, manage=True)
    rows = (await db.execute(
        select(ActivityAttempt, User.full_name).outerjoin(User, User.id == ActivityAttempt.user_id)
        .where(ActivityAttempt.activity_id == a.id).order_by(ActivityAttempt.created_at)
    )).all()
    students: dict[str, dict] = {}
    per_item = [{"q": it["q"], "a": it["a"], "right": 0, "wrong": 0, "wrong_choices": {}} for it in (a.items or [])]
    for att, name in rows:
        key = str(att.user_id) if att.user_id else f"g:{att.guest_phone or att.guest_key or att.guest_name}"
        s = students.setdefault(key, {"name": name or att.guest_name or "—", "guest": att.user_id is None,
                                      "phone": att.guest_phone, "class": att.guest_class,
                                      "attempts": 0, "best_score": 0, "best_pct": 0, "best_time": None, "last_at": None})
        s["attempts"] += 1
        # Time of the best-scoring attempt (faster wins a tie), as on the leaderboard.
        if s["best_time"] is None or att.score > s["best_score"] or (att.score == s["best_score"] and att.duration_sec < s["best_time"]):
            s["best_time"] = round(att.duration_sec, 1)
        s["best_score"] = max(s["best_score"], att.score)
        if att.total:
            s["best_pct"] = max(s["best_pct"], round(100 * att.correct / att.total))
        s["last_at"] = att.created_at.isoformat()
        for ans in att.answers or []:
            if 0 <= ans["i"] < len(per_item):
                it = per_item[ans["i"]]
                if ans["correct"]:
                    it["right"] += 1
                else:
                    it["wrong"] += 1
                    if ans.get("choice"):
                        it["wrong_choices"][ans["choice"]] = it["wrong_choices"].get(ans["choice"], 0) + 1
    for it in per_item:
        seen = it["right"] + it["wrong"]
        it["accuracy"] = round(100 * it["right"] / seen) if seen else None
        it["top_wrong"] = max(it["wrong_choices"], key=it["wrong_choices"].get) if it["wrong_choices"] else None
        del it["wrong_choices"]
    return {
        "activity": {"id": str(a.id), "title": a.title},
        "students": sorted(students.values(), key=lambda s: (-s["best_pct"], s["best_time"] or 0)),
        "items": per_item,
        "total_attempts": len(rows),
    }


# ── Teacher records: everyone who played the teacher's activities ──

@router.get("/records/all")
async def records(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """One row per participant — the teacher's students and the people who
    signed up through a share link — with their best result per activity."""
    _require_teacher(user)
    rows = (await db.execute(
        select(ActivityAttempt, Activity.title, User)
        .join(Activity, Activity.id == ActivityAttempt.activity_id)
        .outerjoin(User, User.id == ActivityAttempt.user_id)
        .where(Activity.owner_id == user.id)
        .order_by(ActivityAttempt.created_at)
    )).all()
    mine = set(await links.student_codes(db, user.id))
    people: dict[str, dict] = {}
    for att, title, u in rows:
        if u:
            key = f"u:{u.id}"
            p = people.setdefault(key, {
                "key": key, "kind": "student" if u.id in mine else "account", "student_id": str(u.id),
                "name": u.full_name, "phone": u.phone, "class": None, "activities": {},
            })
        else:
            key = f"g:{att.guest_phone or att.guest_key or att.guest_name}"
            p = people.setdefault(key, {
                "key": key, "kind": "guest", "student_id": None,
                "name": att.guest_name, "phone": att.guest_phone, "class": att.guest_class, "activities": {},
            })
            p["name"], p["class"] = att.guest_name or p["name"], att.guest_class or p["class"]  # latest details
        act = p["activities"].setdefault(str(att.activity_id), {
            "activity_id": str(att.activity_id), "title": title, "attempts": 0,
            "best_pct": 0, "best_score": 0, "best_time": None, "last_at": None,
        })
        pct = round(100 * att.correct / att.total) if att.total else 0
        act["attempts"] += 1
        if pct > act["best_pct"] or (pct == act["best_pct"] and (act["best_time"] is None or att.duration_sec < act["best_time"])):
            act["best_pct"], act["best_time"] = pct, round(att.duration_sec, 1)
        act["best_score"] = max(act["best_score"], att.score)
        act["last_at"] = att.created_at.isoformat()
    out = []
    for p in people.values():
        acts = sorted(p["activities"].values(), key=lambda x: x["last_at"] or "", reverse=True)
        out.append({
            **p, "activities": acts, "activity_count": len(acts),
            "avg_pct": round(sum(x["best_pct"] for x in acts) / len(acts)) if acts else 0,
            "last_at": acts[0]["last_at"] if acts else None,
        })
    return {"participants": sorted(out, key=lambda x: x["last_at"] or "", reverse=True)}


class ConvertGuestBody(BaseModel):
    phone: str
    full_name: str | None = None
    email: str | None = None


@router.post("/records/convert")
async def convert_guest(body: ConvertGuestBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Add a share-link participant as one of my students: creates the account
    (temporary password shown once) and moves their past results into it."""
    _require_teacher(user)
    from app.routers.teacher import _generate_default_password
    phone = _digits(body.phone)
    if not 8 <= len(phone) <= 15:
        raise HTTPException(status_code=422, detail="رقم موبايل غير صحيح")
    taken = [u for u in (await db.execute(select(User).where(User.phone.is_not(None)))).scalars().all() if _digits(u.phone) == phone]
    if taken:
        raise HTTPException(status_code=409, detail="الرقم ده عليه حساب بالفعل")
    attempts = (await db.execute(
        select(ActivityAttempt).join(Activity, Activity.id == ActivityAttempt.activity_id)
        .where(Activity.owner_id == user.id, ActivityAttempt.user_id.is_(None), ActivityAttempt.guest_phone == phone)
        .order_by(ActivityAttempt.created_at.desc())
    )).scalars().all()
    name = (body.full_name or (attempts[0].guest_name if attempts else "") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="اكتب اسم الطالب")
    email = (body.email or "").strip().lower() or f"{phone}@students.invalid"
    if (await db.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="البريد الإلكتروني مستخدم بالفعل")
    student_code = await links.next_student_code(db, user)
    temp_password = _generate_default_password(name)
    student = User(
        email=email, phone=phone, full_name=name, hashed_password=hash_password(temp_password),
        role=UserRole.STUDENT, status=AccountStatus.ACTIVE, teacher_id=user.id,
        student_code=student_code, must_change_password=True,
    )
    db.add(student)
    await db.flush()
    await links.link(db, user, student)
    for att in attempts:
        att.user_id = student.id
    await db.commit()
    return {"student_id": str(student.id), "full_name": name, "phone": phone, "student_code": student_code,
            "temporary_password": temp_password, "moved_results": len(attempts)}


# ── Flashcard study (spaced repetition) ──────────────────────

_BOX_INTERVALS = {1: timedelta(0), 2: timedelta(days=1), 3: timedelta(days=3), 4: timedelta(days=7), 5: timedelta(days=16)}


@study_router.get("/{lesson_id}")
async def study_progress(lesson_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(FlashcardReview).where(FlashcardReview.user_id == user.id, FlashcardReview.lesson_id == lesson_id))).scalars().all()
    now = datetime.utcnow()
    return {"cards": [
        {"card_index": r.card_index, "box": r.box, "due": r.due_at <= now, "due_at": r.due_at.isoformat(), "reviews": r.reviews}
        for r in rows
    ]}


class ReviewBody(BaseModel):
    card_index: int
    known: bool


@study_router.post("/{lesson_id}/review")
async def review_card(lesson_id: uuid.UUID, body: ReviewBody, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Leitner step: known → next box (reviewed later), forgotten → back to box 1 (now)."""
    if not await db.get(Lesson, lesson_id):
        raise HTTPException(status_code=404, detail="Lesson not found")
    r = (await db.execute(select(FlashcardReview).where(
        FlashcardReview.user_id == user.id, FlashcardReview.lesson_id == lesson_id, FlashcardReview.card_index == body.card_index,
    ))).scalar_one_or_none()
    if not r:
        r = FlashcardReview(user_id=user.id, lesson_id=lesson_id, card_index=body.card_index, box=1, reviews=0)
        db.add(r)
    r.box = min((r.box or 1) + 1, 5) if body.known else 1
    r.due_at = datetime.utcnow() + _BOX_INTERVALS[r.box]
    r.reviews = (r.reviews or 0) + 1
    await db.commit()
    return {"card_index": r.card_index, "box": r.box, "due_at": r.due_at.isoformat()}

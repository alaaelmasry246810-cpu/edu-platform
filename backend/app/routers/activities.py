"""Games & activities (Wordwall/Quizizz/Blooket/Baamboozle-style) and
spaced-repetition flashcard study (Quizlet-style)."""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user, check_quota
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum, Lesson
from app.models.assignment import StudentGroup
from app.models.activity import Activity, ActivityAttempt, FlashcardReview
from app.services import activity_service, lesson_content
from app.services.notification_service import notify

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
    for name in ("is_public", "assigned", "power_ups", "calm_mode"):
        if name in fields and getattr(body, name) is not None:
            setattr(a, name, getattr(body, name))
    if "group_id" in fields:
        a.group_id = body.group_id
    if "due_at" in fields:
        a.due_at = body.due_at
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
        ids = list((await db.execute(select(User.id).where(User.teacher_id == teacher.id, User.role == UserRole.STUDENT))).scalars().all())
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
    n = len(a.items or [])
    answers = [
        {"i": int(x["i"]), "correct": bool(x.get("correct")), "choice": str(x.get("choice") or "")[:200], "ms": int(x.get("ms") or 0)}
        for x in body.answers if isinstance(x, dict) and str(x.get("i", "")).lstrip("-").isdigit() and 0 <= int(x["i"]) < n
    ][:500]
    db.add(ActivityAttempt(
        activity_id=a.id, user_id=user.id, template=body.template[:30],
        score=max(0, body.score), correct=max(0, body.correct), total=max(0, body.total),
        duration_sec=max(0.0, body.duration_sec), answers=answers,
    ))
    a.plays = (a.plays or 0) + 1
    await db.commit()
    return {"message": "saved"}


@router.get("/{activity_id}/report")
async def activity_report(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Per-student results and per-question accuracy (which items the class struggles with)."""
    _require_teacher(user)
    a = await _get_activity(activity_id, user, db, manage=True)
    rows = (await db.execute(
        select(ActivityAttempt, User.full_name).join(User, User.id == ActivityAttempt.user_id)
        .where(ActivityAttempt.activity_id == a.id).order_by(ActivityAttempt.created_at)
    )).all()
    students: dict[str, dict] = {}
    per_item = [{"q": it["q"], "a": it["a"], "right": 0, "wrong": 0, "wrong_choices": {}} for it in (a.items or [])]
    for att, name in rows:
        s = students.setdefault(str(att.user_id), {"name": name, "attempts": 0, "best_score": 0, "best_pct": 0, "last_at": None})
        s["attempts"] += 1
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
        "students": sorted(students.values(), key=lambda s: -s["best_pct"]),
        "items": per_item,
        "total_attempts": len(rows),
    }


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

"""Student schedules — a school class timetable and a flexible study plan.

School schedule: either the student or their teacher can set it; a plain
overwrite, no ownership tracking (it just reflects the real, single school
timetable).

Study schedule: both the student and the teacher can edit it, but on a
conflict — the same (day, start_time) slot touched by both — the teacher's
entry always wins. Each entry is tagged with who authored it so the student
can still see which of their own proposed slots are still standing versus
which were confirmed/overridden by the teacher.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.middleware.auth import get_current_user
from app.services import teachers as links

router = APIRouter(prefix="/schedule", tags=["Schedule"])


class ScheduleEntry(BaseModel):
    day: str            # e.g. "sunday".."saturday"
    start_time: str      # "HH:MM"
    end_time: str
    title: str           # subject name (school) or task/topic (study)


class ScheduleSaveRequest(BaseModel):
    entries: list[ScheduleEntry]


def _serialize(student: User) -> dict:
    return {
        "student_id": str(student.id),
        "school_schedule": student.school_schedule or [],
        "study_schedule": student.study_schedule or [],
    }


async def _get_student_for_view(student_id: str, current_user: User, db: AsyncSession) -> User:
    if student_id == "me":
        if current_user.role != UserRole.STUDENT:
            raise HTTPException(status_code=400, detail="'me' is only valid for student accounts")
        return current_user

    r = await db.execute(select(User).where(User.id == uuid.UUID(student_id)))
    student = r.scalar_one_or_none()
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    if current_user.role == UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role == UserRole.TEACHER and not await links.is_student_of(db, current_user.id, student.id):
        raise HTTPException(status_code=403, detail="Forbidden")
    return student


@router.get("/{student_id}")
async def get_schedule(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """student_id may be 'me' (student viewing their own) or a real id (teacher/admin)."""
    student = await _get_student_for_view(student_id, current_user, db)
    return _serialize(student)


@router.put("/{student_id}/school")
async def save_school_schedule(
    student_id: str,
    body: ScheduleSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Overwrite the school timetable. Either the student themself or their
    teacher/admin may call this — last write wins, no conflict tracking."""
    student = await _get_student_for_view(student_id, current_user, db)
    student.school_schedule = [e.model_dump() for e in body.entries]
    await db.commit()
    return _serialize(student)


@router.put("/{student_id}/study")
async def save_study_schedule(
    student_id: str,
    body: ScheduleSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Propose/overwrite study-plan entries.

    Teachers/admins: their submitted entries always win — each is stored with
    source="teacher", replacing whatever occupied that (day, start_time) slot.
    Existing student-authored entries in OTHER slots are left untouched.

    Students: their submitted entries only apply to slots that are not
    already owned by the teacher. Any incoming entry that collides with a
    teacher-owned slot is skipped (and reported back) rather than applied,
    so the teacher's choice for that slot always stands.
    """
    student = await _get_student_for_view(student_id, current_user, db)
    is_teacher_edit = current_user.role in (UserRole.TEACHER, UserRole.ADMIN)

    existing = {(e["day"], e["start_time"]): e for e in (student.study_schedule or [])}
    skipped: list[dict] = []

    if is_teacher_edit:
        for entry in body.entries:
            key = (entry.day, entry.start_time)
            existing[key] = {**entry.model_dump(), "source": "teacher"}
    else:
        for entry in body.entries:
            key = (entry.day, entry.start_time)
            current = existing.get(key)
            if current and current.get("source") == "teacher":
                skipped.append(entry.model_dump())
                continue
            existing[key] = {**entry.model_dump(), "source": "student"}

    student.study_schedule = list(existing.values())
    await db.commit()
    return {**_serialize(student), "skipped": skipped}


@router.delete("/{student_id}/study/entry")
async def remove_study_entry(
    student_id: str,
    day: str = Query(...),
    start_time: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a single study-schedule slot. Students may only remove their
    own entries; teachers/admins may remove any entry."""
    student = await _get_student_for_view(student_id, current_user, db)
    is_teacher_edit = current_user.role in (UserRole.TEACHER, UserRole.ADMIN)

    entries = student.study_schedule or []
    target = next((e for e in entries if e["day"] == day and e["start_time"] == start_time), None)
    if not target:
        raise HTTPException(status_code=404, detail="الموعد غير موجود")
    if not is_teacher_edit and target.get("source") == "teacher":
        raise HTTPException(status_code=403, detail="المعلم هو اللي حدد الميعاد ده")

    student.study_schedule = [
        e for e in entries if not (e["day"] == day and e["start_time"] == start_time)
    ]
    await db.commit()
    return _serialize(student)

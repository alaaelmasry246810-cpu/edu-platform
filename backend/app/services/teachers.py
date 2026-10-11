"""Student ↔ teacher links (see models/teacher_student.py)."""
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.teacher_student import TeacherStudent
from app.models.user import User


def students_of(teacher_id):
    """Filter for User queries: students linked to this teacher."""
    return User.id.in_(select(TeacherStudent.student_id).where(TeacherStudent.teacher_id == teacher_id))


async def is_student_of(db: AsyncSession, teacher_id, student_id) -> bool:
    return bool(await db.scalar(
        select(func.count()).select_from(TeacherStudent)
        .where(TeacherStudent.teacher_id == teacher_id, TeacherStudent.student_id == student_id)
    ))


async def student_codes(db: AsyncSession, teacher_id) -> dict[uuid.UUID, str | None]:
    rows = await db.execute(select(TeacherStudent.student_id, TeacherStudent.student_code).where(TeacherStudent.teacher_id == teacher_id))
    return dict(rows.all())


async def next_student_code(db: AsyncSession, teacher: User) -> str | None:
    """e.g. 'AB12CD34-03' — derived from the teacher's join code."""
    if not teacher.teacher_code:
        return None
    count = await db.scalar(select(func.count()).select_from(TeacherStudent).where(TeacherStudent.teacher_id == teacher.id))
    return f"{teacher.teacher_code}-{(count or 0) + 1:02d}"


async def link(db: AsyncSession, teacher: User, student: User) -> TeacherStudent:
    """Add the student to the teacher (no-op if already linked). The first
    teacher a student joins becomes their active one. Caller commits."""
    existing = await db.get(TeacherStudent, (teacher.id, student.id))
    if existing:
        return existing
    code = await next_student_code(db, teacher)
    ts = TeacherStudent(teacher_id=teacher.id, student_id=student.id, student_code=code)
    db.add(ts)
    if student.teacher_id is None:
        student.teacher_id = teacher.id
    if not student.student_code:
        student.student_code = code
    await db.flush()
    return ts


async def unlink(db: AsyncSession, teacher_id, student: User) -> None:
    """Remove the student from the teacher; if it was the active teacher, switch
    to another one they still have (or none). Caller commits."""
    await db.execute(delete(TeacherStudent).where(TeacherStudent.teacher_id == teacher_id, TeacherStudent.student_id == student.id))
    if student.teacher_id == teacher_id:
        student.teacher_id = await db.scalar(
            select(TeacherStudent.teacher_id).where(TeacherStudent.student_id == student.id)
            .order_by(TeacherStudent.created_at).limit(1)
        )

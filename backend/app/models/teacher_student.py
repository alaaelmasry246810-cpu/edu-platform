"""Which teachers a student studies with — a student can join several.

users.teacher_id stays the student's ACTIVE teacher: the one whose curricula,
assignments, activities and videos the student currently sees (they switch it
from their account). This table is the full list, and what teacher-side pages
use to find "my students"."""
import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TeacherStudent(Base):
    __tablename__ = "teacher_students"

    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    student_code: Mapped[str | None] = mapped_column(String(50), nullable=True)  # this teacher's code for the student
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

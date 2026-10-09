"""Teacher-assigned exams/practice — a teacher creates one of these upfront,
targets specific students (ad hoc and/or via a saved StudentGroup), optionally
schedules it, and each targeted student gets their own QuizAttempt lazily
when they actually start it (see AssignmentTarget + QuizAttempt.assignment_id)."""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum, ForeignKey, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.exam import ExamType


class StudentGroup(Base):
    """A teacher's reusable named group of students (a "class")."""
    __tablename__ = "student_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_ids: Mapped[list] = mapped_column(JSON, default=list)  # list of student UUID strings

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Assignment(Base):
    """A teacher-created exam/practice, targeted at specific students."""
    __tablename__ = "assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # "exam" | "practice" — display/filter label only; actual behavior is the
    # two explicit knobs below, which the teacher sets regardless of kind.
    kind: Mapped[str] = mapped_column(String(20), default="practice", nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)

    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)
    exam_type: Mapped[ExamType] = mapped_column(Enum(ExamType), default=ExamType.COMPREHENSIVE)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)

    # Traceability only — targets are resolved into AssignmentTarget rows at
    # creation time, so editing this group later never retroactively changes
    # who was targeted by a past assignment.
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("student_groups.id"), nullable=True)

    available_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Null = inherit the curriculum's configured ExamTypeConfig.time_limit_minutes
    # for this exam_type; set = override it just for this one assignment.
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    allow_multiple_attempts: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    auto_reveal_score: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    targets: Mapped[list["AssignmentTarget"]] = relationship(
        "AssignmentTarget", back_populates="assignment", cascade="all, delete-orphan"
    )


class AssignmentTarget(Base):
    """One row per (assignment, targeted student) — the assignment's roster."""
    __tablename__ = "assignment_targets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="targets")

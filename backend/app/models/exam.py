"""
Exam system models:
- ExamTypeConfig  : admin-configured settings per exam type (time, points, pass %)
- QuizAttempt     : student exam attempt with per-question grading
- TeacherEvaluation: teacher review/approval of an attempt
- MemorizationProgress: track flashcard mastery per student per lesson
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Enum, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


class ExamType(str, enum.Enum):
    LESSON_PRACTICE   = "lesson_practice"   # تدريب على درس
    UNIT_PRACTICE     = "unit_practice"     # تدريب على وحدة
    COMPREHENSIVE     = "comprehensive"     # امتحان شامل


class AttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED   = "submitted"      # Auto-graded, pending teacher review for open questions
    APPROVED    = "approved"       # Teacher approved / fully graded
    REJECTED    = "rejected"       # Teacher flagged for revision
    NEEDS_REVIEW = "needs_review"  # Has open questions needing manual grade


# ─── Admin-Configurable Exam Settings ────────────────────────────────────────

class ExamTypeConfig(Base):
    """One row per ExamType + curriculum — admin can override per curriculum or set global defaults."""
    __tablename__ = "exam_type_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Scope: null = global default, set = per-curriculum override
    curriculum_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=True)

    exam_type: Mapped[ExamType] = mapped_column(Enum(ExamType), nullable=False)

    # Timing
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=30)

    # Question counts per type
    mcq_count:        Mapped[int] = mapped_column(Integer, default=10)
    true_false_count: Mapped[int] = mapped_column(Integer, default=5)
    fill_blank_count: Mapped[int] = mapped_column(Integer, default=3)
    why_count:        Mapped[int] = mapped_column(Integer, default=2)
    essay_count:      Mapped[int] = mapped_column(Integer, default=0)

    # Points per question type
    mcq_points:        Mapped[float] = mapped_column(Float, default=2.0)
    true_false_points: Mapped[float] = mapped_column(Float, default=1.0)
    fill_blank_points: Mapped[float] = mapped_column(Float, default=2.0)
    why_points:        Mapped[float] = mapped_column(Float, default=5.0)
    essay_points:      Mapped[float] = mapped_column(Float, default=10.0)

    # Passing threshold (percentage)
    pass_threshold: Mapped[float] = mapped_column(Float, default=60.0)

    # Difficulty
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ─── Quiz Attempt ────────────────────────────────────────────────────────────

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    # Scope
    exam_type: Mapped[ExamType] = mapped_column(Enum(ExamType), default=ExamType.COMPREHENSIVE)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)

    # Config snapshot at the time of exam creation
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    # Questions as generated (list of question dicts)
    questions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Student answers: {question_index: answer_text}
    answers: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Per-question grading results
    # [{q_index, student_answer, correct_answer, is_correct, points_earned, max_points, type, needs_manual}]
    question_results: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Scores
    auto_score:    Mapped[float | None] = mapped_column(Float, nullable=True)   # auto-graded points
    manual_score:  Mapped[float | None] = mapped_column(Float, nullable=True)   # teacher-graded open questions
    total_score:   Mapped[float | None] = mapped_column(Float, nullable=True)   # auto + manual
    max_score:     Mapped[float | None] = mapped_column(Float, nullable=True)
    percentage:    Mapped[float | None] = mapped_column(Float, nullable=True)
    passed:        Mapped[bool | None]  = mapped_column(Boolean, nullable=True)

    # Timing
    time_limit_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_taken_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status & teacher evaluation
    status: Mapped[AttemptStatus] = mapped_column(Enum(AttemptStatus), default=AttemptStatus.IN_PROGRESS)

    started_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    student: Mapped["User"] = relationship("User", back_populates="quiz_attempts", foreign_keys=[student_id])
    evaluation: Mapped["TeacherEvaluation | None"] = relationship("TeacherEvaluation", back_populates="attempt", uselist=False, cascade="all, delete-orphan")


# ─── Teacher Evaluation ───────────────────────────────────────────────────────

class TeacherEvaluation(Base):
    __tablename__ = "teacher_evaluations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_attempts.id"), nullable=False, unique=True)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Per-question manual grades for open questions: {q_index: points_given}
    manual_grades: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Overall feedback
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_grade_override: Mapped[float | None] = mapped_column(Float, nullable=True)  # Optional override
    status: Mapped[str] = mapped_column(String(20), default="approved")  # approved | rejected | needs_revision

    evaluated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    attempt: Mapped["QuizAttempt"] = relationship("QuizAttempt", back_populates="evaluation")
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])


# ─── Memorization Progress ────────────────────────────────────────────────────

class MemorizationProgress(Base):
    """Track student's flashcard mastery per lesson — accumulates in their account."""
    __tablename__ = "memorization_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=False)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)

    total_cards: Mapped[int] = mapped_column(Integer, default=0)
    mastered_cards: Mapped[int] = mapped_column(Integer, default=0)
    # Indices of mastered cards: [0, 2, 5, ...]
    mastered_indices: Mapped[list] = mapped_column(JSON, default=list)

    last_studied: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    study_streak_days: Mapped[int] = mapped_column(Integer, default=0)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0)

    student: Mapped["User"] = relationship("User", back_populates="memorization_sessions")

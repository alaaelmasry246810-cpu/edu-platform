import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Enum, JSON, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class QuestionType(str, enum.Enum):
    MCQ = "mcq"                    # اختيار من متعدد
    TRUE_FALSE = "true_false"      # صح وخطأ
    FILL_BLANK = "fill_blank"      # أكمل الفراغ
    WHY = "why"                    # علل
    ESSAY = "essay"                # مقالي
    PROBLEM = "problem"            # مسائل/قواعد


class Curriculum(Base):
    __tablename__ = "curricula"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Optional: scope this curriculum to one of the teacher's student groups
    # (e.g. "Grade 3A"). Null means it isn't tied to a particular group and
    # shows up regardless of the group filter.
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("student_groups.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    grade_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # "curriculum" (default — teaching material, chunked/embedded for RAG) or
    # "exam" (an already-written exam paper — real questions/answers are
    # extracted verbatim instead of AI-generated; see exam_extraction_service).
    content_type: Mapped[str] = mapped_column(String(20), default="curriculum", nullable=False)

    # File info
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Qdrant collection namespace
    vector_collection_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="curricula")
    units: Mapped[list["Unit"]] = relationship("Unit", back_populates="curriculum", cascade="all, delete-orphan", order_by="Unit.order")


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)

    curriculum: Mapped["Curriculum"] = relationship("Curriculum", back_populates="units")
    lessons: Mapped[list["Lesson"]] = relationship("Lesson", back_populates="unit", cascade="all, delete-orphan", order_by="Lesson.order")


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=False)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    # Raw lesson text as extracted from the uploaded file (source for
    # interactive-video scripts; null for curricula processed before it existed)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI-generated content (cached)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_terms: Mapped[dict | None] = mapped_column(JSON, nullable=True)    # {term: definition}
    flashcards: Mapped[list | None] = mapped_column(JSON, nullable=True)   # [{front, back, hint}]

    # Media
    video_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # YouTube or any URL
    video_title: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Progress flag
    has_summary: Mapped[bool] = mapped_column(default=False)

    unit: Mapped["Unit"] = relationship("Unit", back_populates="lessons")
    questions: Mapped[list["Question"]] = relationship("Question", back_populates="lesson", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id"), nullable=True)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id"), nullable=False)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=True)

    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")  # easy|medium|hard
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)      # For MCQ
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)   # Why this answer

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lesson: Mapped["Lesson | None"] = relationship("Lesson", back_populates="questions")


# QuizAttempt moved to app.models.exam — import from there

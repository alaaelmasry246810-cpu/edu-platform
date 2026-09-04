"""Shared Question Bank — teachers publish questions to a shared pool others can browse/import."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class SharedQuestion(Base):
    __tablename__ = "shared_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    # Question content
    question: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(30), nullable=False)  # mcq, true_false, fill_blank, why, essay
    correct_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)       # for MCQ
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    subject_tag: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "رياضيات", "فيزياء"
    grade_level: Mapped[str | None] = mapped_column(String(50), nullable=True)   # e.g. "الصف الثالث الثانوي"
    points: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)

    # Metadata
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

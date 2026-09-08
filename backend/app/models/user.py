import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Enum, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class AccountStatus(str, enum.Enum):
    PENDING = "pending"        # Awaiting admin approval
    ACTIVE = "active"
    SUSPENDED = "suspended"
    REJECTED = "rejected"


class SubscriptionPlan(str, enum.Enum):
    FREE = "free"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    # Login identifier (replaces email for sign-in). Nullable at the DB level
    # only so older rows created before this field existed don't break —
    # every new registration path requires and validates it.
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.STUDENT)
    status: Mapped[AccountStatus] = mapped_column(Enum(AccountStatus), default=AccountStatus.PENDING)
    # Set when status becomes SUSPENDED automatically (e.g. "devtools_detected"),
    # so an admin/teacher reviewing the account can tell it apart from a manual
    # suspension. Cleared whenever the account is reactivated.
    suspension_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan: Mapped[SubscriptionPlan] = mapped_column(Enum(SubscriptionPlan), default=SubscriptionPlan.FREE)

    # Multi-teacher: student belongs to a teacher
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    # Teacher join code — unique per teacher, students use it at registration
    teacher_code: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    # Student's own code — derived from their teacher's code (e.g. "T-AB12CD-03")
    student_code: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)

    # Usage tracking
    pages_uploaded_this_month: Mapped[int] = mapped_column(Integer, default=0)
    questions_generated_today: Mapped[int] = mapped_column(Integer, default=0)
    summaries_generated_this_month: Mapped[int] = mapped_column(Integer, default=0)
    usage_reset_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Subscription
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Per-student AI assist (toggled by teacher) ──────────────
    ai_assist_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Forces a password-change screen on next login — true whenever someone
    # else (admin/teacher) set the password for this account, false once the
    # user has chosen their own password (self-registration or after change).
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Per-teacher feature permissions (set by admin) ──────────
    # JSON object with boolean flags, e.g.:
    # {"can_grant_ai_assist": true, "can_export_pdf": true, "can_access_question_bank": true}
    teacher_features: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Teacher's own educational channel links (YouTube/Telegram/etc.), gated
    # by the "can_add_channel_links" feature flag. List of {"label", "url"}.
    channel_links: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Student schedules (meaningful for STUDENT accounts) ─────
    # School class timetable — either the student or their teacher can set
    # it; plain overwrite, no ownership tracking. List of
    # {"day", "start_time", "end_time", "subject"}.
    school_schedule: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Flexible self-study plan — both student and teacher can edit it, but
    # on conflict the teacher's entry for a given (day, start_time) slot
    # always wins; each entry carries "source": "teacher" | "student" so the
    # student still sees what's left for them to fill in. List of
    # {"day", "start_time", "end_time", "title", "source"}.
    study_schedule: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    curricula: Mapped[list["Curriculum"]] = relationship("Curriculum", back_populates="owner", cascade="all, delete-orphan")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship("QuizAttempt", back_populates="student", foreign_keys="QuizAttempt.student_id")
    # Students this teacher has
    students: Mapped[list["User"]] = relationship("User", foreign_keys=[teacher_id])
    # Memorization progress
    memorization_sessions: Mapped[list["MemorizationProgress"]] = relationship("MemorizationProgress", back_populates="student", cascade="all, delete-orphan")

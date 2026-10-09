"""Games & activities — one set of question/answer items that plays in many
templates (quiz, wheel, match, crossword, gold quest, team board…), can be
assigned as self-paced homework, run as a live game, shared in a public
library, and printed as a worksheet. Also spaced-repetition progress for a
lesson's flashcards."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Activity(Base):
    """items: [{q, a, options?: [str], hint?}] — `a` is the correct answer; when
    options are missing the player builds distractors from the other answers."""
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    curriculum_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id", ondelete="SET NULL"), nullable=True, index=True)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    grade_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    items: Mapped[list] = mapped_column(JSON, default=list)
    template: Mapped[str] = mapped_column(String(30), default="quiz")   # default template it opens in

    is_public: Mapped[bool] = mapped_column(Boolean, default=False)      # shown in the public library
    plays: Mapped[int] = mapped_column(Integer, default=0)
    copied_from_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Self-paced homework (Quizizz-style): visible to the teacher's students
    # (or one group of them) until due_at, optionally with power-ups.
    assigned: Mapped[bool] = mapped_column(Boolean, default=False)
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("student_groups.id", ondelete="SET NULL"), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    power_ups: Mapped[bool] = mapped_column(Boolean, default=True)
    time_per_question: Mapped[int] = mapped_column(Integer, default=20)  # seconds (timed quiz / live game)
    # Calm mode for older students: no sounds, memes or flashy animations.
    calm_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    # Hard time limit (minutes) for game templates so play never crowds out learning; null = none.
    game_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Share link (/a/<share_token>), fully controlled by the teacher: on/off,
    # open to anyone (guests play under a name) or only the teacher's own
    # students, and whether players can see the leaderboard. Regenerating the
    # token kills the old link.
    link_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    allow_guests: Mapped[bool] = mapped_column(Boolean, default=True)
    leaderboard_visible: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityAttempt(Base):
    """One finished play of an activity — by a signed-in user, or by a guest
    (user_id null, guest_name set) who opened the teacher's share link.
    answers: [{i, correct, choice, ms}] — i is the item index."""
    __tablename__ = "activity_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    guest_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Groups one guest's attempts (kept in their browser) so the leaderboard
    # shows each guest once even if two pick the same name.
    guest_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    template: Mapped[str] = mapped_column(String(30), nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    duration_sec: Mapped[float] = mapped_column(Float, default=0)
    answers: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LiveSession(Base):
    """A live (Kahoot-style) game: the host screen shows each question, players
    answer from their phones; faster correct answers score more.
    questions: snapshot [{q, options, answer_index}] taken at creation.
    status: lobby → question → reveal → (next question …) → ended."""
    __tablename__ = "live_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False)
    host_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    pin: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="lobby")
    questions: Mapped[list] = mapped_column(JSON, default=list)
    current_index: Mapped[int] = mapped_column(Integer, default=-1)
    time_limit: Mapped[int] = mapped_column(Integer, default=20)
    question_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LivePlayer(Base):
    """answers: {"<question index>": {choice, correct, points, ms}}"""
    __tablename__ = "live_players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False)   # the player's secret (guests can join by PIN)
    nickname: Mapped[str] = mapped_column(String(40), nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[dict] = mapped_column(JSON, default=dict)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FlashcardReview(Base):
    """Leitner-box spaced repetition for one student × one flashcard of a lesson
    (Quizlet-style "Learn"): box 1 = review now … box 5 = mastered."""
    __tablename__ = "flashcard_reviews"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", "card_index", name="uq_flashcard_review"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True)
    card_index: Mapped[int] = mapped_column(Integer, nullable=False)
    box: Mapped[int] = mapped_column(Integer, default=1)
    due_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviews: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

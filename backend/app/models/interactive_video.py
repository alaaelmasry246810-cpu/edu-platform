import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.database import Base
from app.models.curriculum import ProcessingStatus


class VideoSource(str, enum.Enum):
    AI = "ai"            # AI writes the script + scenes, TTS narrates each scene
    PODCAST = "podcast"  # teacher records/uploads audio, AI lays scenes + questions over it
    UPLOAD = "upload"    # teacher uploads a real video, AI (optionally) adds questions on top


class InteractiveVideo(Base):
    """An interactive video for a lesson, or for a whole unit (chapter) when
    lesson_id is null.

    Nothing is rendered to an mp4 on the server: the player in the browser
    composes the scenes (slides) over the narration/podcast audio, or plays the
    uploaded video, and pauses at each interaction to ask the student a
    question.

    scenes:       [{title, bullets: [str], narration, visual, visual_type, visual_data,
                    start?, audio_url?}] — visual_type/visual_data: see video_visuals
                  start (seconds) is set for podcast videos, audio_url for AI ones.
    interactions: [{id, type, question, options?, correct_answer, explanation,
                    time? (seconds), after_scene? (scene index)}]
                  AI videos anchor questions to a scene (after_scene); podcast
                  and uploaded videos anchor them to a time. An uploaded video
                  too large to transcribe gets time=null and the player spreads
                  those evenly over the video's duration.
    """
    __tablename__ = "interactive_videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    curriculum_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("curricula.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"), nullable=True, index=True)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[VideoSource] = mapped_column(Enum(VideoSource), nullable=False)
    status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    voice: Mapped[str | None] = mapped_column(String(50), nullable=True)            # TTS voice (AI videos)
    script_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)      # lesson_text | explain (AI videos)
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)            # teacher-pasted text to script from
    media_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)      # podcast audio / uploaded video
    media_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    transcript: Mapped[list | None] = mapped_column(JSON, nullable=True)            # [{start, end, text}]
    scenes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    interactions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

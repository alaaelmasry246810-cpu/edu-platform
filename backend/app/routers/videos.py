"""Interactive videos — per lesson or per unit (chapter), made by AI, from a
teacher podcast, or from a teacher-uploaded video."""
import shutil
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user, check_quota
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum, Unit, Lesson, ProcessingStatus
from app.models.interactive_video import InteractiveVideo, VideoSource
from app.services import video_service, text_track, lesson_content, storage
from app.services.tasks import run_or_schedule
from app.routers.uploads import owned_key

router = APIRouter(prefix="/videos", tags=["Interactive Videos"])

_AUDIO_EXT = {".mp3", ".m4a", ".wav", ".webm", ".ogg", ".mp4", ".mpeg", ".mpga"}
_VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}


def _require_teacher(user: User):
    if user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Teachers only")


def _storage_prefix(video: InteractiveVideo) -> str:
    return f"videos/{video.owner_id}/{video.id}"


def _video_dir(video: InteractiveVideo) -> Path:
    """Local working copy (also the permanent copy when storage isn't remote)."""
    return Path(settings.UPLOAD_DIR) / _storage_prefix(video)


def _serialize(v: InteractiveVideo) -> dict:
    return {
        "id": str(v.id),
        "curriculum_id": str(v.curriculum_id),
        "unit_id": str(v.unit_id) if v.unit_id else None,
        "lesson_id": str(v.lesson_id) if v.lesson_id else None,
        "scope": "lesson" if v.lesson_id else "unit",
        "title": v.title,
        "source": v.source,
        "status": v.status,
        "error_message": v.error_message,
        "voice": v.voice,
        "script_mode": v.script_mode,
        "media_url": v.media_url,
        "scenes": v.scenes or [],
        "interactions": v.interactions or [],
        "has_transcript": bool(v.transcript),
        "is_published": v.is_published,
        "display_mode": v.display_mode or "visual",
        "text_track": v.text_track,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


async def _resolve_scope(
    curriculum_id: uuid.UUID, unit_id: uuid.UUID | None, lesson_id: uuid.UUID | None,
    user: User, db: AsyncSession,
) -> tuple[Curriculum, Unit, Lesson | None]:
    """Validate the target (a lesson, or a whole unit) belongs to this teacher."""
    curriculum = (await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))).scalar_one_or_none()
    if not curriculum or (curriculum.owner_id != user.id and user.role != UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Curriculum not found")
    lesson = None
    if lesson_id:
        lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id, Lesson.curriculum_id == curriculum_id))).scalar_one_or_none()
        if not lesson:
            raise HTTPException(status_code=404, detail="Lesson not found")
        unit_id = lesson.unit_id
    if not unit_id:
        raise HTTPException(status_code=400, detail="lesson_id or unit_id is required")
    unit = (await db.execute(select(Unit).where(Unit.id == unit_id, Unit.curriculum_id == curriculum_id))).scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return curriculum, unit, lesson


async def _get_video(video_id: uuid.UUID, user: User, db: AsyncSession, manage: bool = False) -> InteractiveVideo:
    video = (await db.execute(select(InteractiveVideo).where(InteractiveVideo.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if user.role == UserRole.ADMIN or video.owner_id == user.id:
        return video
    if not manage and user.role == UserRole.STUDENT and video.owner_id == user.teacher_id and video.is_published:
        return video
    raise HTTPException(status_code=404, detail="Video not found")


async def _save_upload(file: UploadFile, dest: Path, max_mb: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    limit = max_mb * 1024 * 1024
    written = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(1024 * 1024):
            written += len(chunk)
            if written > limit:
                await out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File too large (max {max_mb}MB)")
            await out.write(chunk)


async def _lesson_text(video: InteractiveVideo, curriculum: Curriculum, db: AsyncSession) -> str:
    return await lesson_content.lesson_text(db, curriculum, video.lesson_id, video.unit_id, video.source_text)


async def _video_content(video: InteractiveVideo, curriculum: Curriculum, db: AsyncSession) -> str:
    return await lesson_content.generation_text(db, curriculum, video.lesson_id, video.unit_id, video.source_text)


# ── Listing ──────────────────────────────────────────────────

@router.get("/")
async def list_videos(
    lesson_id: uuid.UUID | None = None,
    unit_id: uuid.UUID | None = None,
    curriculum_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """lesson_id returns that lesson's videos plus its unit's chapter-wide ones."""
    q = select(InteractiveVideo)
    if current_user.role == UserRole.STUDENT:
        q = q.where(InteractiveVideo.owner_id == current_user.teacher_id, InteractiveVideo.is_published.is_(True))
    elif current_user.role != UserRole.ADMIN:
        q = q.where(InteractiveVideo.owner_id == current_user.id)

    if lesson_id:
        lesson = (await db.execute(select(Lesson).where(Lesson.id == lesson_id))).scalar_one_or_none()
        if not lesson:
            return []
        q = q.where(or_(
            InteractiveVideo.lesson_id == lesson_id,
            and_(InteractiveVideo.unit_id == lesson.unit_id, InteractiveVideo.lesson_id.is_(None)),
        ))
    elif unit_id:
        q = q.where(InteractiveVideo.unit_id == unit_id)
    elif curriculum_id:
        q = q.where(InteractiveVideo.curriculum_id == curriculum_id)

    rows = (await db.execute(q.order_by(InteractiveVideo.created_at.desc()))).scalars().all()
    return [_serialize(v) for v in rows]


@router.get("/voices")
async def list_voices(current_user: User = Depends(get_current_user)):
    return {"voices": video_service.TTS_VOICES}


@router.get("/{video_id}")
async def get_video(video_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return _serialize(await _get_video(video_id, current_user, db))


# ── Create: AI ───────────────────────────────────────────────

class AIVideoRequest(BaseModel):
    curriculum_id: uuid.UUID
    lesson_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    title: str | None = None
    voice: str = "nova"
    scene_count: int = 6
    # "lesson_text": narration follows the lesson's own text; "explain": free teacher-style explanation
    script_mode: str = "lesson_text"
    # Optional text the teacher pastes to script from instead of the stored lesson text
    source_text: str | None = None
    # What the player shows: "visual" scenes, the lesson "text" with the spoken
    # sentence highlighted, or "both"
    display_mode: str = "visual"


DISPLAY_MODES = {"visual", "text", "both"}


def _display_mode(value: str | None) -> str:
    return value if value in DISPLAY_MODES else "visual"


@router.post("/ai", status_code=202)
async def create_ai_video(
    body: AIVideoRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_teacher(current_user)
    check_quota(current_user, "summary")
    curriculum, unit, lesson = await _resolve_scope(body.curriculum_id, body.unit_id, body.lesson_id, current_user, db)
    video = InteractiveVideo(
        owner_id=curriculum.owner_id,
        curriculum_id=curriculum.id,
        unit_id=unit.id,
        lesson_id=lesson.id if lesson else None,
        title=(body.title or "").strip() or (lesson.title if lesson else unit.title),
        source=VideoSource.AI,
        status=ProcessingStatus.PENDING,
        voice=body.voice if body.voice in video_service.TTS_VOICES else "nova",
        script_mode=body.script_mode if body.script_mode in video_service.SCRIPT_MODES else "lesson_text",
        source_text=(body.source_text or "").strip() or None,
        display_mode=_display_mode(body.display_mode),
    )
    db.add(video)
    await db.commit()
    await run_or_schedule(background_tasks, _process_ai_video, str(video.id), min(max(body.scene_count, 3), 12))
    await db.refresh(video)
    return _serialize(video)


async def _process_ai_video(video_id: str, scene_count: int):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        video = await db.get(InteractiveVideo, uuid.UUID(video_id))
        curriculum = await db.get(Curriculum, video.curriculum_id) if video else None
        if not video or not curriculum:
            return
        try:
            video.status = ProcessingStatus.PROCESSING
            await db.commit()

            content = await _video_content(video, curriculum, db)
            if not content:
                raise ValueError("لم يتم العثور على محتوى لهذا الدرس/الفصل في المنهج")
            script = await video_service.build_ai_script(content, video.title, scene_count, video.script_mode or "lesson_text")
            if not script["scenes"]:
                raise ValueError("فشل توليد مشاهد الفيديو")

            await _voice_scenes(video, script["scenes"])
            video.scenes = script["scenes"]
            video.interactions = script["interactions"]
            video.status = ProcessingStatus.COMPLETED
            video.error_message = None
        except Exception as e:
            video.status = ProcessingStatus.FAILED
            video.error_message = str(e)[:1000]
        await db.commit()


async def _voice_scenes(video: InteractiveVideo, scenes: list[dict]) -> None:
    out_dir = _video_dir(video)
    for i, scene in enumerate(scenes):
        text = scene.get("narration") or ". ".join([scene.get("title", "")] + scene.get("bullets", []))
        # New file name per synthesis so browsers never replay a cached old take.
        name = f"scene_{i}_{uuid.uuid4().hex[:6]}.mp3"
        path = out_dir / name
        await video_service.synthesize(text, video.voice or "nova", path)
        await storage.delete_url(scene.get("audio_url"))
        scene["audio_url"] = await storage.save_file(f"{_storage_prefix(video)}/{name}", path, "audio/mpeg")
        if storage.remote():
            path.unlink(missing_ok=True)


# ── Create: podcast / uploaded video ─────────────────────────

@router.post("/podcast", status_code=202)
async def create_podcast_video(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(None),
    storage_key: str | None = Form(None),
    curriculum_id: uuid.UUID = Form(...),
    lesson_id: uuid.UUID | None = Form(None),
    unit_id: uuid.UUID | None = Form(None),
    title: str = Form(""),
    display_mode: str = Form("both"),
    source_text: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _create_media_video(
        VideoSource.PODCAST, _AUDIO_EXT, True,
        background_tasks, file, curriculum_id, lesson_id, unit_id, title, current_user, db,
        display_mode=display_mode, source_text=source_text, storage_key=storage_key,
    )


@router.post("/upload", status_code=202)
async def create_uploaded_video(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(None),
    storage_key: str | None = Form(None),
    curriculum_id: uuid.UUID = Form(...),
    lesson_id: uuid.UUID | None = Form(None),
    unit_id: uuid.UUID | None = Form(None),
    title: str = Form(""),
    auto_interactions: bool = Form(True),
    display_mode: str = Form("visual"),
    source_text: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _create_media_video(
        VideoSource.UPLOAD, _VIDEO_EXT, auto_interactions,
        background_tasks, file, curriculum_id, lesson_id, unit_id, title, current_user, db,
        display_mode=display_mode, source_text=source_text, storage_key=storage_key,
    )


async def _create_media_video(
    source: VideoSource, allowed_ext: set[str], process: bool,
    background_tasks: BackgroundTasks, file: UploadFile | None,
    curriculum_id: uuid.UUID, lesson_id: uuid.UUID | None, unit_id: uuid.UUID | None, title: str,
    current_user: User, db: AsyncSession,
    display_mode: str = "visual", source_text: str = "", storage_key: str | None = None,
):
    _require_teacher(current_user)
    curriculum, unit, lesson = await _resolve_scope(curriculum_id, unit_id, lesson_id, current_user, db)
    # The lesson-text view needs a transcript to time the sentences.
    if display_mode in ("text", "both"):
        process = True
    if not file and not storage_key:
        raise HTTPException(status_code=422, detail="No file uploaded")
    if storage_key:
        owned_key(storage_key, "videos", current_user.id)
    ext = Path((file.filename if file else storage_key) or "").suffix.lower() or (".webm" if source == VideoSource.PODCAST else "")
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    if process:
        check_quota(current_user, "summary")

    video = InteractiveVideo(
        owner_id=curriculum.owner_id,
        curriculum_id=curriculum.id,
        unit_id=unit.id,
        lesson_id=lesson.id if lesson else None,
        title=title.strip() or (lesson.title if lesson else unit.title),
        source=source,
        status=ProcessingStatus.PENDING if process else ProcessingStatus.COMPLETED,
        interactions=[],
        scenes=[],
        display_mode=_display_mode(display_mode),
        source_text=source_text.strip() or None,
    )
    db.add(video)
    await db.flush()

    dest = _video_dir(video) / f"media{ext}"
    if storage_key:
        # Already in storage (uploaded by the browser); fetched locally only if transcribed.
        video.media_url = storage.public_url(storage_key)
    else:
        await _save_upload(file, dest, settings.MAX_VIDEO_UPLOAD_MB)
        try:
            video.media_url = await storage.save_file(f"{_storage_prefix(video)}/media{ext}", dest, file.content_type)
        except RuntimeError as e:
            dest.unlink(missing_ok=True)
            raise HTTPException(status_code=502, detail=f"تعذّر حفظ الملف: {e}")
    video.media_path = str(dest)  # local working copy for transcription
    await db.commit()

    if process:
        await run_or_schedule(background_tasks, _process_media_video, str(video.id))
        await db.refresh(video)
    return _serialize(video)


async def _process_media_video(video_id: str):
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        video = await db.get(InteractiveVideo, uuid.UUID(video_id))
        curriculum = await db.get(Curriculum, video.curriculum_id) if video else None
        if not video or not curriculum:
            return
        try:
            video.status = ProcessingStatus.PROCESSING
            await db.commit()

            lesson_text = await _lesson_text(video, curriculum, db)
            content = lesson_text or await _video_content(video, curriculum, db)
            # The local copy may be gone (disk wiped on restart) — fetch it back from storage.
            media = await storage.fetch_to(video.media_url, Path(video.media_path))
            segments = await video_service.transcribe(media)
            is_podcast = video.source == VideoSource.PODCAST

            if segments:
                video.transcript = segments
                video.text_track = text_track.build_text_track(lesson_text, segments)
                script = await video_service.build_timed_script(segments, content, video.title, with_scenes=is_podcast)
                video.scenes = script["scenes"]
                video.interactions = script["interactions"]
            elif is_podcast:
                raise ValueError("التسجيل الصوتي أكبر من 25MB أو فارغ — قسّمه لأجزاء أصغر")
            elif content:
                video.interactions = await video_service.build_untimed_questions(content, video.title)
            video.status = ProcessingStatus.COMPLETED
            video.error_message = None
        except Exception as e:
            video.status = ProcessingStatus.FAILED
            video.error_message = str(e)[:1000]
        await db.commit()


# ── Edit / publish / delete ──────────────────────────────────

class VideoUpdate(BaseModel):
    title: str | None = None
    is_published: bool | None = None
    scenes: list[dict] | None = None
    interactions: list[dict] | None = None
    voice: str | None = None
    display_mode: str | None = None


@router.patch("/{video_id}")
async def update_video(
    video_id: uuid.UUID,
    body: VideoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_teacher(current_user)
    video = await _get_video(video_id, current_user, db, manage=True)
    if body.title is not None and body.title.strip():
        video.title = body.title.strip()
    if body.voice in video_service.TTS_VOICES:
        video.voice = body.voice
    if body.display_mode in DISPLAY_MODES:
        video.display_mode = body.display_mode
    if body.scenes is not None:
        old = {i: s.get("audio_url") for i, s in enumerate(video.scenes or [])}
        timed = video.source == VideoSource.PODCAST
        scenes = video_service._clean_scenes(body.scenes, timed=timed)
        # Keep each scene's narration audio only if it was sent back unchanged;
        # edited narration is re-voiced via /regenerate-audio.
        for i, s in enumerate(scenes):
            sent = body.scenes[i] if i < len(body.scenes) else {}
            if sent.get("audio_url") and sent.get("audio_url") == old.get(i):
                s["audio_url"] = sent["audio_url"]
        video.scenes = scenes
    if body.interactions is not None:
        anchor = "scene" if video.source == VideoSource.AI else "time"
        video.interactions = video_service.clean_interactions(body.interactions, anchor, len(video.scenes or []))
    if body.is_published is not None:
        if body.is_published and video.status != ProcessingStatus.COMPLETED:
            raise HTTPException(status_code=400, detail="Video is not ready yet")
        video.is_published = body.is_published
    await db.commit()
    return _serialize(video)


@router.post("/{video_id}/regenerate-audio")
async def regenerate_audio(
    video_id: uuid.UUID,
    only_missing: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-voice AI scenes (only the ones without audio, i.e. edited, by default)."""
    _require_teacher(current_user)
    video = await _get_video(video_id, current_user, db, manage=True)
    if video.source != VideoSource.AI:
        raise HTTPException(status_code=400, detail="Only AI videos have generated narration")
    scenes = [dict(s) for s in (video.scenes or [])]
    targets = [s for s in scenes if not (only_missing and s.get("audio_url"))]
    if targets:
        await _voice_scenes(video, targets)
    video.scenes = scenes
    await db.commit()
    return _serialize(video)


@router.post("/{video_id}/regenerate")
async def regenerate_video(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    scene_count: int = 6,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run the AI step from scratch (script for AI videos, scenes/questions for media)."""
    _require_teacher(current_user)
    check_quota(current_user, "summary")
    video = await _get_video(video_id, current_user, db, manage=True)
    if video.status == ProcessingStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Already processing")
    video.status = ProcessingStatus.PENDING
    video.is_published = False
    await db.commit()
    if video.source == VideoSource.AI:
        await run_or_schedule(background_tasks, _process_ai_video, str(video.id), min(max(scene_count, 3), 12))
    else:
        await run_or_schedule(background_tasks, _process_media_video, str(video.id))
    await db.refresh(video)
    return _serialize(video)


@router.delete("/{video_id}")
async def delete_video(video_id: uuid.UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_teacher(current_user)
    video = await _get_video(video_id, current_user, db, manage=True)
    shutil.rmtree(_video_dir(video), ignore_errors=True)
    await storage.delete_prefix(_storage_prefix(video))
    await storage.delete_url(video.media_url)  # a browser upload lives outside that prefix
    await db.delete(video)
    await db.commit()
    return {"message": "تم حذف الفيديو"}

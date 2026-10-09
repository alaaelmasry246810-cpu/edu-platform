"""Curriculum upload, processing, and content retrieval endpoints."""
import os
import uuid
import asyncio
import logging
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum, Unit, Lesson, Question, ProcessingStatus, QuestionType
from app.models.assignment import StudentGroup
from app.middleware.auth import get_current_user, get_uploader, check_quota, create_upload_session_token
from app.config import settings
from app.services.ocr_service import DocumentParser, CurriculumChunker, PageText
from app.services import rag_service, qr_service, exam_extraction_service
from app.services.notification_service import notify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/curricula", tags=["Curriculum"])
parser = DocumentParser()
chunker = CurriculumChunker()

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
CONTENT_TYPES = {"curriculum", "exam"}


@router.post("/upload-session")
async def create_upload_session(current_user: User = Depends(get_current_user)):
    """Mint a short-lived token a phone can use to upload to /curricula/upload
    without logging in — meant to be embedded in a QR code shown on desktop."""
    token = create_upload_session_token(str(current_user.id), current_user.role.value)
    return {"token": token, "expires_in": 600}


async def _validate_owned_group(group_id: uuid.UUID | None, teacher_id: uuid.UUID, db: AsyncSession) -> None:
    if not group_id:
        return
    r = await db.execute(
        select(StudentGroup.id).where(StudentGroup.id == group_id, StudentGroup.teacher_id == teacher_id)
    )
    if not r.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Group not found")


@router.post("/upload", status_code=202)
async def upload_curriculum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(None),
    grade_level: str = Form(None),
    content_type: str = Form("curriculum"),
    group_id: uuid.UUID | None = Form(None),
    current_user: User = Depends(get_uploader),
    db: AsyncSession = Depends(get_db)
):
    check_quota(current_user, "upload")

    if content_type not in CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid content_type: {content_type}")

    await _validate_owned_group(group_id, current_user.id, db)

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Save file
    user_dir = Path(settings.UPLOAD_DIR) / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    file_path = user_dir / f"{uuid.uuid4()}{ext}"

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    file_path.write_bytes(content)

    # Create DB record
    curriculum = Curriculum(
        owner_id=current_user.id,
        group_id=group_id,
        title=title,
        subject=subject,
        grade_level=grade_level,
        file_path=str(file_path),
        status=ProcessingStatus.PENDING,
        vector_collection_id=f"curr_{uuid.uuid4().hex[:12]}",
        content_type=content_type,
    )
    db.add(curriculum)
    await db.flush()
    curr_id = curriculum.id
    collection_id = curriculum.vector_collection_id

    # Update usage
    current_user.pages_uploaded_this_month += 1

    # Background processing
    background_tasks.add_task(
        _process_curriculum, str(curr_id), str(file_path), ext, collection_id
    )

    return {
        "curriculum_id": str(curr_id),
        "status": "processing",
        "message": "Curriculum uploaded. AI processing started in background."
    }


async def _process_curriculum(curriculum_id: str, file_path: str, ext: str, collection_id: str):
    """Background task: OCR → structure → chunk → vectorize."""
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Curriculum).where(Curriculum.id == uuid.UUID(curriculum_id)))
        curriculum = result.scalar_one_or_none()
        if not curriculum:
            return

        try:
            curriculum.status = ProcessingStatus.PROCESSING
            await db.commit()

            # 1. Parse pages
            if ext == ".pdf":
                pages = await parser.parse_pdf(file_path)
            else:
                page = await parser.parse_image(file_path)
                pages = [page]

            # 1b. Best-effort: pull in content behind any QR codes found on the pages
            extra_pages, qr_skipped = await _ingest_qr_content(pages, file_path, ext)
            if extra_pages:
                pages = pages + extra_pages
            if qr_skipped:
                await notify(
                    db,
                    user_id=curriculum.owner_id,
                    title="تم تخطي رابط QR في المنهج",
                    body=f"'{curriculum.title}' فيه كود QR ملقيناش نقدر نجيب المحتوى بتاعه تلقائيًا.",
                    notif_type="qr_import_skipped",
                    link=f"/teacher/curricula/{curriculum.id}",
                )

            curriculum.total_pages = len(pages)

            # 2. Detect structure
            structure = chunker.detect_structure(pages)

            # 3. Save structure to DB + index vectors
            for u_idx, unit_data in enumerate(structure["units"]):
                unit = Unit(
                    curriculum_id=curriculum.id,
                    title=unit_data["title"],
                    order=u_idx,
                )
                db.add(unit)
                await db.flush()

                for l_idx, lesson_data in enumerate(unit_data.get("lessons", [])):
                    lesson = Lesson(
                        unit_id=unit.id,
                        curriculum_id=curriculum.id,
                        title=lesson_data["title"],
                        order=l_idx,
                    )
                    db.add(lesson)
                    await db.flush()

                    lesson_text = lesson_data.get("text", "")
                    lesson.content_text = lesson_text or None
                    if curriculum.content_type == "exam":
                        # Extract the real questions/answers already on the
                        # page instead of chunking for RAG/generation.
                        extracted = await exam_extraction_service.extract_exam_questions(lesson_text)
                        for q in extracted:
                            try:
                                q_type = QuestionType(q["type"])
                            except ValueError:
                                q_type = QuestionType.ESSAY
                            db.add(Question(
                                curriculum_id=curriculum.id,
                                unit_id=unit.id,
                                lesson_id=lesson.id,
                                question_type=q_type,
                                question_text=q["question"],
                                options=q.get("options"),
                                correct_answer=q.get("correct_answer") or "",
                                explanation=q.get("explanation"),
                            ))
                    else:
                        # Chunk and index lesson text for RAG
                        chunks = chunker.make_rag_chunks(
                            lesson_text,
                            metadata={
                                "curriculum_id": curriculum_id,
                                "unit_id": str(unit.id),
                                "lesson_id": str(lesson.id),
                                "unit_title": unit_data["title"],
                                "lesson_title": lesson_data["title"],
                            }
                        )
                        if chunks:
                            await rag_service.index_chunks(collection_id, chunks)

            curriculum.status = ProcessingStatus.COMPLETED
            curriculum.processed_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            curriculum.status = ProcessingStatus.FAILED
            curriculum.error_message = str(e)
            await db.commit()


async def _ingest_qr_content(pages: list[PageText], file_path: str, ext: str) -> tuple[list[PageText], bool]:
    """Look for QR codes on the uploaded pages and, for any that link to a
    supported document, parse it and return it as extra pages to merge in.

    Never raises — a QR problem is an enrichment miss, not an upload failure.
    Returns (extra_pages, any_skipped).
    """
    try:
        page_images = parser.render_page_images(file_path, ext)
    except Exception:
        logger.exception("Failed to render page images for QR scan: %s", file_path)
        return [], False

    qr_urls: list[str] = []
    for img_bytes in page_images:
        for url in qr_service.detect_qr_urls(img_bytes):
            if url not in qr_urls:
                qr_urls.append(url)

    if not qr_urls:
        return [], False

    extra_pages: list[PageText] = []
    any_skipped = False
    next_page_num = len(pages) + 1

    for url in qr_urls:
        fetched = await qr_service.fetch_qr_document(url)
        if not fetched:
            any_skipped = True
            continue

        content, qr_ext = fetched
        try:
            with tempfile.NamedTemporaryFile(suffix=qr_ext, delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                if qr_ext == ".pdf":
                    qr_pages = await parser.parse_pdf(tmp_path)
                else:
                    qr_pages = [await parser.parse_image(tmp_path)]
            finally:
                os.unlink(tmp_path)
        except Exception:
            logger.exception("Failed to parse QR-linked document: %s", url)
            any_skipped = True
            continue

        for p in qr_pages:
            extra_pages.append(PageText(page_num=next_page_num, text=p.text, confidence=p.confidence))
            next_page_num += 1

    return extra_pages, any_skipped


@router.get("/")
async def list_curricula(
    group_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # A student sees their teacher's curricula, not their own (students don't own any).
    owner_id = current_user.teacher_id if current_user.role == UserRole.STUDENT else current_user.id
    q = select(Curriculum).where(Curriculum.owner_id == owner_id)
    if group_id:
        q = q.where(Curriculum.group_id == group_id)
    result = await db.execute(q.order_by(Curriculum.created_at.desc()))
    return result.scalars().all()


class GroupAssignRequest(BaseModel):
    group_id: uuid.UUID | None = None


@router.patch("/{curriculum_id}/group")
async def assign_curriculum_group(
    curriculum_id: uuid.UUID,
    body: GroupAssignRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Move a curriculum into (or out of, with group_id=null) one of the teacher's groups."""
    result = await db.execute(
        select(Curriculum).where(Curriculum.id == curriculum_id, Curriculum.owner_id == current_user.id)
    )
    curriculum = result.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    await _validate_owned_group(body.group_id, current_user.id, db)
    curriculum.group_id = body.group_id
    await db.commit()
    return {"message": "تم تحديث المجموعة", "group_id": str(body.group_id) if body.group_id else None}


@router.delete("/{curriculum_id}")
async def delete_curriculum(
    curriculum_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Curriculum).where(
            Curriculum.id == curriculum_id,
            Curriculum.owner_id == current_user.id
        )
    )
    curriculum = result.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")

    # Best-effort cleanup of the vector store and uploaded file — a failure
    # here shouldn't block the teacher from removing the curriculum itself.
    if curriculum.vector_collection_id:
        try:
            await rag_service.delete_curriculum_vectors(curriculum.vector_collection_id, str(curriculum.id))
        except Exception:
            logger.exception("Failed to delete Qdrant vectors for curriculum %s", curriculum.id)

    file_path = curriculum.file_path

    await db.delete(curriculum)
    await db.commit()

    if file_path:
        try:
            os.remove(file_path)
        except OSError:
            pass

    return {"message": "تم حذف المنهج"}


@router.delete("/{curriculum_id}/lessons/{lesson_id}/questions/{question_id}")
async def delete_lesson_question(
    curriculum_id: uuid.UUID,
    lesson_id: uuid.UUID,
    question_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Teacher deletes one verbatim-extracted exam question they no longer want kept."""
    owns = await db.execute(
        select(Curriculum.id).where(
            Curriculum.id == curriculum_id, Curriculum.owner_id == current_user.id
        )
    )
    if not owns.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Curriculum not found")

    q_result = await db.execute(
        select(Question).where(
            Question.id == question_id,
            Question.curriculum_id == curriculum_id,
            Question.lesson_id == lesson_id,
        )
    )
    question = q_result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await db.delete(question)
    await db.commit()
    return {"message": "تم حذف السؤال"}


@router.get("/{curriculum_id}/structure")
async def get_structure(
    curriculum_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    curriculum = result.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    is_owner = curriculum.owner_id == current_user.id
    is_student_of_owner = current_user.role == UserRole.STUDENT and curriculum.owner_id == current_user.teacher_id
    if not (is_owner or is_student_of_owner or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=404, detail="Curriculum not found")

    units_result = await db.execute(
        select(Unit).where(Unit.curriculum_id == curriculum_id).order_by(Unit.order)
    )
    units = units_result.scalars().all()

    tree = []
    for unit in units:
        lessons_result = await db.execute(
            select(Lesson).where(Lesson.unit_id == unit.id).order_by(Lesson.order)
        )
        tree.append({
            "id": str(unit.id),
            "title": unit.title,
            "lessons": [
                {
                    "id": str(l.id),
                    "title": l.title,
                    "has_summary": bool(l.summary),
                    "has_flashcards": bool(l.flashcards),
                    "has_video": bool(l.video_url),
                    "video_url": l.video_url,
                    "video_title": l.video_title,
                }
                for l in lessons_result.scalars().all()
            ]
        })

    return {
        "curriculum": {
            "id": str(curriculum.id),
            "title": curriculum.title,
            "status": curriculum.status,
            "total_pages": curriculum.total_pages,
            "content_type": curriculum.content_type,
        },
        "units": tree
    }


@router.get("/{curriculum_id}/lessons/{lesson_id}/questions")
async def get_lesson_questions(
    curriculum_id: uuid.UUID,
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Real questions extracted verbatim from a scanned exam paper (content_type="exam")."""
    result = await db.execute(
        select(Curriculum).where(
            Curriculum.id == curriculum_id,
            Curriculum.owner_id == current_user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Curriculum not found")

    questions_result = await db.execute(
        select(Question)
        .where(Question.curriculum_id == curriculum_id, Question.lesson_id == lesson_id)
        .order_by(Question.created_at)
    )
    return {
        "questions": [
            {
                "id": str(q.id),
                "type": q.question_type.value,
                "question": q.question_text,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
            }
            for q in questions_result.scalars().all()
        ]
    }

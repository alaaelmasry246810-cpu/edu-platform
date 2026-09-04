"""Curriculum upload, processing, and content retrieval endpoints."""
import os
import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.curriculum import Curriculum, Unit, Lesson, Question, ProcessingStatus, QuestionType
from app.middleware.auth import get_current_user, check_quota
from app.config import settings
from app.services.ocr_service import DocumentParser, CurriculumChunker
from app.services import rag_service

router = APIRouter(prefix="/curricula", tags=["Curriculum"])
parser = DocumentParser()
chunker = CurriculumChunker()

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


@router.post("/upload", status_code=202)
async def upload_curriculum(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(None),
    grade_level: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_quota(current_user, "upload")

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
        title=title,
        subject=subject,
        grade_level=grade_level,
        file_path=str(file_path),
        status=ProcessingStatus.PENDING,
        vector_collection_id=f"curr_{uuid.uuid4().hex[:12]}",
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

                    # Chunk and index lesson text
                    chunks = chunker.make_rag_chunks(
                        lesson_data.get("text", ""),
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


@router.get("/")
async def list_curricula(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Curriculum).where(Curriculum.owner_id == current_user.id)
        .order_by(Curriculum.created_at.desc())
    )
    return result.scalars().all()


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
    await db.delete(curriculum)
    await db.commit()
    return {"message": "تم حذف المنهج"}


@router.get("/{curriculum_id}/structure")
async def get_structure(
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
        },
        "units": tree
    }

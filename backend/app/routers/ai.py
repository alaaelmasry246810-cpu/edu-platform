"""AI endpoints — explanation, summary, key terms, question generation, exams with live grading."""
import uuid, json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum, Lesson, Unit, Question, QuestionType
from app.models.exam import (
    QuizAttempt, ExamTypeConfig, ExamType, AttemptStatus, MemorizationProgress
)
from app.middleware.auth import get_current_user, check_quota
from app.services import rag_service
from app.services.notification_service import notify

router = APIRouter(prefix="/ai", tags=["AI"])

_OPEN_TYPES = {"why", "essay"}   # require manual grading
_AUTO_TYPES = {"mcq", "true_false", "fill_blank"}


def _get_collection(curriculum: Curriculum) -> str:
    return curriculum.vector_collection_id or f"curr_{curriculum.id.hex[:12]}"


# ── Lesson AI ────────────────────────────────────────────────

@router.get("/lesson/{lesson_id}/explanation")
async def get_explanation(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    if lesson.explanation:
        return {"explanation": lesson.explanation, "cached": True}
    curriculum = await _get_curriculum(lesson.curriculum_id, db)
    check_quota(current_user, "summary")
    result = await rag_service.generate_with_rag(
        _get_collection(curriculum),
        f"اشرح الدرس '{lesson.title}' شرحاً وافياً ومبسطاً بأسلوب يناسب الطلاب.",
        filter_metadata={"lesson_id": str(lesson_id)},
        system_extra="نسّق الشرح بنقاط واضحة."
    )
    lesson.explanation = result
    await db.commit()
    return {"explanation": result, "cached": False}


@router.get("/lesson/{lesson_id}/summary")
async def get_summary(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    if lesson.summary:
        return {"summary": lesson.summary, "cached": True}
    curriculum = await _get_curriculum(lesson.curriculum_id, db)
    check_quota(current_user, "summary")
    result = await rag_service.generate_with_rag(
        _get_collection(curriculum),
        f"لخّص الدرس '{lesson.title}' في نقاط مختصرة وشاملة للمراجعة السريعة.",
        filter_metadata={"lesson_id": str(lesson_id)},
    )
    lesson.summary = result
    lesson.has_summary = True
    current_user.summaries_generated_this_month += 1
    await db.commit()
    return {"summary": result, "cached": False}


@router.get("/lesson/{lesson_id}/key-terms")
async def get_key_terms(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    if lesson.key_terms:
        return {"key_terms": lesson.key_terms, "cached": True}
    curriculum = await _get_curriculum(lesson.curriculum_id, db)
    result = await rag_service.generate_with_rag(
        _get_collection(curriculum),
        f"""استخرج من درس '{lesson.title}' قائمة بجميع:
- التعريفات والمصطلحات
- القواعد والقوانين
- المفاهيم الأساسية

أعدها بصيغة JSON: {{"term": "definition", ...}}""",
        filter_metadata={"lesson_id": str(lesson_id)},
    )
    try:
        s = result.find("{"); e = result.rfind("}") + 1
        terms = json.loads(result[s:e]) if s >= 0 else {}
    except Exception:
        terms = {}
    lesson.key_terms = terms
    await db.commit()
    return {"key_terms": terms, "cached": False}


# ── Question Bank ────────────────────────────────────────────

class QuestionRequest(BaseModel):
    types: list[str] = ["mcq", "true_false", "why"]
    count: int = 10
    difficulty: str = "medium"
    lesson_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None


@router.post("/curriculum/{curriculum_id}/questions")
async def generate_questions(
    curriculum_id: uuid.UUID,
    body: QuestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_quota(current_user, "questions")
    curriculum = await _get_curriculum(curriculum_id, db)
    if curriculum.owner_id != current_user.id and current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Forbidden")

    filter_meta = {"curriculum_id": str(curriculum_id)}
    if body.lesson_id:
        filter_meta["lesson_id"] = str(body.lesson_id)
    elif body.unit_id:
        filter_meta["unit_id"] = str(body.unit_id)

    questions = await rag_service.generate_questions(
        _get_collection(curriculum),
        question_types=body.types,
        filter_metadata=filter_meta,
        count=body.count,
        difficulty=body.difficulty,
    )
    current_user.questions_generated_today += len(questions)
    await db.commit()
    return {"questions": questions, "count": len(questions)}


# ── Exam System ───────────────────────────────────────────────

class ExamCreateRequest(BaseModel):
    curriculum_id: uuid.UUID
    exam_type: ExamType = ExamType.COMPREHENSIVE
    lesson_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None


class ExamSubmitRequest(BaseModel):
    attempt_id: uuid.UUID
    # {question_index_str: answer_text}
    answers: dict[str, str]
    time_taken_seconds: int


@router.post("/exam/create")
async def create_exam(
    body: ExamCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new exam attempt and return questions with config."""
    check_quota(current_user, "questions")
    curriculum = await _get_curriculum(body.curriculum_id, db)

    # Load exam config (curriculum-specific or global)
    cfg_q = select(ExamTypeConfig).where(
        ExamTypeConfig.exam_type == body.exam_type,
        ExamTypeConfig.curriculum_id == body.curriculum_id
    )
    result = await db.execute(cfg_q)
    config = result.scalar_one_or_none()

    if not config:
        # fall back to global default
        result = await db.execute(
            select(ExamTypeConfig).where(
                ExamTypeConfig.exam_type == body.exam_type,
                ExamTypeConfig.curriculum_id == None
            )
        )
        config = result.scalar_one_or_none()

    # Build question counts and points map
    if config:
        counts = {
            "mcq": config.mcq_count,
            "true_false": config.true_false_count,
            "fill_blank": config.fill_blank_count,
            "why": config.why_count,
            "essay": config.essay_count,
        }
        points_map = {
            "mcq": config.mcq_points,
            "true_false": config.true_false_points,
            "fill_blank": config.fill_blank_points,
            "why": config.why_points,
            "essay": config.essay_points,
        }
        time_limit = config.time_limit_minutes
        difficulty = config.difficulty
        pass_threshold = config.pass_threshold
    else:
        counts = {"mcq": 10, "true_false": 5, "fill_blank": 3, "why": 2, "essay": 0}
        points_map = {"mcq": 2.0, "true_false": 1.0, "fill_blank": 2.0, "why": 5.0, "essay": 10.0}
        time_limit = 30
        difficulty = "medium"
        pass_threshold = 60.0

    # Generate questions for each type
    filter_meta = {"curriculum_id": str(body.curriculum_id)}
    if body.lesson_id:
        filter_meta["lesson_id"] = str(body.lesson_id)
    elif body.unit_id:
        filter_meta["unit_id"] = str(body.unit_id)

    all_questions = []
    for qtype, count in counts.items():
        if count > 0:
            qs = await rag_service.generate_questions(
                _get_collection(curriculum),
                question_types=[qtype],
                filter_metadata=filter_meta,
                count=count,
                difficulty=difficulty,
            )
            # attach points and index
            for q in qs:
                q["points"] = points_map.get(qtype, 2.0)
            all_questions.extend(qs)

    # Attach sequential index
    for i, q in enumerate(all_questions):
        q["index"] = i

    config_snapshot = {
        "exam_type": body.exam_type.value,
        "time_limit_minutes": time_limit,
        "pass_threshold": pass_threshold,
        "points_map": points_map,
        "counts": counts,
        "difficulty": difficulty,
    }

    attempt = QuizAttempt(
        student_id=current_user.id,
        curriculum_id=body.curriculum_id,
        teacher_id=current_user.teacher_id,
        exam_type=body.exam_type,
        lesson_id=body.lesson_id,
        unit_id=body.unit_id,
        config=config_snapshot,
        questions=all_questions,
        time_limit_seconds=time_limit * 60,
        max_score=sum(q["points"] for q in all_questions),
        status=AttemptStatus.IN_PROGRESS,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    # Don't return correct_answer in questions list (student shouldn't see it upfront)
    safe_questions = []
    for q in all_questions:
        sq = {k: v for k, v in q.items() if k != "correct_answer"}
        safe_questions.append(sq)

    return {
        "attempt_id": str(attempt.id),
        "questions": safe_questions,
        "time_limit_seconds": attempt.time_limit_seconds,
        "max_score": attempt.max_score,
        "pass_threshold": pass_threshold,
        "config": config_snapshot,
    }


@router.post("/exam/submit")
async def submit_exam(
    body: ExamSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grade submitted answers: auto-grade closed questions, flag open ones for teacher."""
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == body.attempt_id,
            QuizAttempt.student_id == current_user.id,
            QuizAttempt.status == AttemptStatus.IN_PROGRESS
        )
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found or already submitted")

    attempt.answers = body.answers
    attempt.time_taken_seconds = body.time_taken_seconds
    attempt.submitted_at = datetime.utcnow()

    # ── Grade each question ──────────────────────────────────
    question_results = []
    auto_score = 0.0
    needs_manual = False

    for q in attempt.questions:
        idx = q["index"]
        qtype = q.get("type", "mcq")
        max_pts = float(q.get("points", 2.0))
        student_ans = (body.answers.get(str(idx)) or "").strip()
        correct_ans = q.get("correct_answer", "")

        if qtype in _OPEN_TYPES:
            # Cannot auto-grade: flag for teacher
            question_results.append({
                "q_index": idx,
                "type": qtype,
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": None,
                "points_earned": None,
                "max_points": max_pts,
                "needs_manual": True,
                "explanation": q.get("explanation"),
            })
            needs_manual = True
        else:
            # Auto-grade: normalise and compare
            is_correct = _answers_match(student_ans, correct_ans, qtype)
            pts = max_pts if is_correct else 0.0
            auto_score += pts
            question_results.append({
                "q_index": idx,
                "type": qtype,
                "question": q.get("question"),
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct,
                "points_earned": pts,
                "max_points": max_pts,
                "needs_manual": False,
                "explanation": q.get("explanation"),
                "options": q.get("options"),
            })

    attempt.question_results = question_results
    attempt.auto_score = auto_score
    attempt.max_score = attempt.max_score or sum(q.get("points", 2.0) for q in attempt.questions)

    if needs_manual:
        attempt.status = AttemptStatus.NEEDS_REVIEW
        # Total score is partial until teacher grades open questions
        attempt.total_score = auto_score
    else:
        attempt.status = AttemptStatus.SUBMITTED
        attempt.total_score = auto_score
        pct = (auto_score / attempt.max_score * 100) if attempt.max_score else 0
        attempt.percentage = round(pct, 1)
        attempt.passed = pct >= attempt.config.get("pass_threshold", 60.0)

    # Notify teacher (if linked)
    if attempt.teacher_id:
        exam_label = {"lesson_practice": "تدريب درس", "unit_practice": "تدريب وحدة", "comprehensive": "امتحان شامل"}.get(attempt.exam_type.value, "اختبار")
        r_student = await db.execute(select(User).where(User.id == attempt.student_id))
        student = r_student.scalar_one_or_none()
        student_name = student.full_name if student else "طالب"
        await notify(
            db,
            user_id=attempt.teacher_id,
            title=f"اختبار جديد بانتظار المراجعة 📋",
            body=f"{student_name} أكمل {exam_label}",
            notif_type="exam_submitted",
            link=f"/teacher/pending/{attempt.id}",
        )

    await db.commit()

    return {
        "attempt_id": str(attempt.id),
        "status": attempt.status.value,
        "auto_score": attempt.auto_score,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "needs_manual_grading": needs_manual,
        "question_results": question_results,
    }


@router.get("/exam/{attempt_id}/result")
async def get_exam_result(
    attempt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch full result for an attempt (student can see own, teacher can see students')."""
    r = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if current_user.role == UserRole.STUDENT and attempt.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role == UserRole.TEACHER and attempt.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "attempt_id": str(attempt.id),
        "status": attempt.status.value,
        "exam_type": attempt.exam_type.value,
        "auto_score": attempt.auto_score,
        "manual_score": attempt.manual_score,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percentage": attempt.percentage,
        "passed": attempt.passed,
        "time_taken_seconds": attempt.time_taken_seconds,
        "time_limit_seconds": attempt.time_limit_seconds,
        "question_results": attempt.question_results,
        "config": attempt.config,
        "submitted_at": attempt.submitted_at.isoformat() if attempt.submitted_at else None,
    }


@router.get("/student/adaptive-difficulty")
async def get_adaptive_difficulty(
    curriculum_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the recommended difficulty level based on last 5 attempts."""
    q = select(QuizAttempt).where(
        QuizAttempt.student_id == current_user.id,
        QuizAttempt.percentage != None,
    )
    if curriculum_id:
        q = q.where(QuizAttempt.curriculum_id == curriculum_id)
    q = q.order_by(QuizAttempt.submitted_at.desc()).limit(5)
    r = await db.execute(q)
    recent = r.scalars().all()

    if not recent:
        return {"difficulty": "medium", "reason": "لا توجد اختبارات سابقة — مستوى متوسط افتراضي", "avg_percentage": None}

    avg = sum(a.percentage for a in recent) / len(recent)

    if avg >= 85:
        difficulty, reason = "hard", f"أداؤك ممتاز (متوسط {avg:.0f}%) — ننتقل لمستوى صعب 🔥"
    elif avg >= 60:
        difficulty, reason = "medium", f"أداؤك جيد (متوسط {avg:.0f}%) — نواصل بالمستوى المتوسط ✅"
    else:
        difficulty, reason = "easy", f"المتوسط {avg:.0f}% — نبدأ بمستوى أسهل لتثبيت الأساس 💪"

    return {"difficulty": difficulty, "reason": reason, "avg_percentage": round(avg, 1)}


@router.get("/student/ai-assist-status")
async def get_ai_assist_status(
    current_user: User = Depends(get_current_user),
):
    """Check if the current student has AI exam assist enabled."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    return {"ai_assist_enabled": current_user.ai_assist_enabled}


class HintRequest(BaseModel):
    question_text: str
    question_type: str          # mcq | true_false | fill_blank | why | essay
    options: list[str] | None = None  # for MCQ


@router.post("/exam/hint")
async def get_exam_hint(
    body: HintRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return an AI hint (not the full answer) for a question. Only if student has ai_assist_enabled."""
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Students only")
    if not current_user.ai_assist_enabled:
        raise HTTPException(status_code=403, detail="مساعد الذكاء الاصطناعي غير مفعّل لحسابك. تواصل مع معلمك.")

    # Build a hint prompt — gives guidance, not the direct answer
    if body.question_type == "mcq" and body.options:
        opts_text = "\n".join(f"{chr(0x41+i)}) {o}" for i, o in enumerate(body.options))
        prompt = (
            f"السؤال:\n{body.question_text}\n\nالخيارات:\n{opts_text}\n\n"
            "أعطِ الطالب تلميحاً يساعده على التفكير في الإجابة الصحيحة دون أن تذكر الإجابة مباشرة. "
            "وجّهه نحو المفهوم الأساسي أو ميّز الخيارات الصحيحة من الخاطئة بطريقة غير مباشرة. "
            "اكتب بالعربية. لا تزيد عن 80 كلمة."
        )
    elif body.question_type in ("why", "essay"):
        prompt = (
            f"السؤال:\n{body.question_text}\n\n"
            "أعطِ الطالب تلميحاً يساعده على بناء إجابته دون أن تكتب الإجابة بدلاً عنه. "
            "أشر إلى النقاط الرئيسية التي يجب تغطيتها أو المفاهيم المرتبطة بالسؤال. "
            "اكتب بالعربية. لا تزيد عن 80 كلمة."
        )
    else:
        prompt = (
            f"السؤال:\n{body.question_text}\n\n"
            "أعطِ الطالب تلميحاً يرشده نحو الإجابة دون ذكرها مباشرة. اكتب بالعربية. لا تزيد عن 60 كلمة."
        )

    from openai import AsyncOpenAI
    from app.config import settings as _settings
    _ai = AsyncOpenAI(api_key=_settings.OPENAI_API_KEY)
    response = await _ai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "أنت مساعد تعليمي يعطي تلميحات للطلاب دون إفساد الإجابة."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=200,
        temperature=0.5,
    )
    hint = response.choices[0].message.content.strip()
    return {"hint": hint}


@router.get("/student/attempts")
async def list_my_attempts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all of the current student's quiz attempts."""
    r = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.student_id == current_user.id)
        .order_by(QuizAttempt.started_at.desc())
    )
    attempts = r.scalars().all()
    return [{
        "attempt_id": str(a.id),
        "exam_type": a.exam_type.value,
        "status": a.status.value,
        "total_score": a.total_score,
        "max_score": a.max_score,
        "percentage": a.percentage,
        "passed": a.passed,
        "started_at": a.started_at.isoformat(),
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
    } for a in attempts]


# ── Memorization Progress ────────────────────────────────────

class MemorizationUpdate(BaseModel):
    mastered_indices: list[int]
    total_cards: int


@router.post("/lesson/{lesson_id}/memorization")
async def update_memorization(
    lesson_id: uuid.UUID,
    body: MemorizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson_bare(lesson_id, db)
    r = await db.execute(
        select(MemorizationProgress).where(
            MemorizationProgress.student_id == current_user.id,
            MemorizationProgress.lesson_id == lesson_id
        )
    )
    progress = r.scalar_one_or_none()
    if not progress:
        progress = MemorizationProgress(
            student_id=current_user.id,
            lesson_id=lesson_id,
            curriculum_id=lesson.curriculum_id,
        )
        db.add(progress)

    progress.mastered_indices = body.mastered_indices
    progress.mastered_cards = len(body.mastered_indices)
    progress.total_cards = body.total_cards
    progress.last_studied = datetime.utcnow()
    progress.total_sessions = (progress.total_sessions or 0) + 1
    await db.commit()
    return {"mastered": progress.mastered_cards, "total": progress.total_cards}


@router.get("/lesson/{lesson_id}/memorization")
async def get_memorization(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    r = await db.execute(
        select(MemorizationProgress).where(
            MemorizationProgress.student_id == current_user.id,
            MemorizationProgress.lesson_id == lesson_id
        )
    )
    p = r.scalar_one_or_none()
    if not p:
        return {"mastered_indices": [], "mastered_cards": 0, "total_cards": 0}
    return {
        "mastered_indices": p.mastered_indices,
        "mastered_cards": p.mastered_cards,
        "total_cards": p.total_cards,
        "last_studied": p.last_studied.isoformat() if p.last_studied else None,
        "total_sessions": p.total_sessions,
    }


# ── Flashcards ───────────────────────────────────────────────

@router.get("/lesson/{lesson_id}/flashcards")
async def get_flashcards(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    if lesson.flashcards:
        return {"flashcards": lesson.flashcards, "cached": True}
    curriculum = await _get_curriculum(lesson.curriculum_id, db)
    cards = await rag_service.generate_flashcards(
        _get_collection(curriculum),
        filter_metadata={"lesson_id": str(lesson_id)},
        count=12,
    )
    lesson.flashcards = cards
    await db.commit()
    return {"flashcards": cards, "cached": False}


@router.delete("/lesson/{lesson_id}/flashcards")
async def reset_flashcards(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    lesson.flashcards = None
    await db.commit()
    return {"message": "تم مسح الفلاش كارد — هيتولدوا من جديد"}


# ── Video Management ──────────────────────────────────────────

class VideoUpdate(BaseModel):
    video_url: str
    video_title: str | None = None


@router.patch("/lesson/{lesson_id}/video")
async def update_lesson_video(
    lesson_id: uuid.UUID,
    body: VideoUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    lesson.video_url = body.video_url
    lesson.video_title = body.video_title
    await db.commit()
    return {"message": "تم تحديث الفيديو", "video_url": lesson.video_url}


@router.delete("/lesson/{lesson_id}/video")
async def remove_lesson_video(
    lesson_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lesson = await _get_lesson(lesson_id, current_user, db)
    lesson.video_url = None
    lesson.video_title = None
    await db.commit()
    return {"message": "تم حذف الفيديو"}


# ── Curriculum-wide Summary ───────────────────────────────────

@router.get("/curriculum/{curriculum_id}/all-terms")
async def get_all_terms(
    curriculum_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    curriculum = await _get_curriculum(curriculum_id, db)
    if curriculum.owner_id != current_user.id and current_user.role not in (UserRole.TEACHER, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Forbidden")

    result = await rag_service.generate_with_rag(
        _get_collection(curriculum),
        """اجمع قائمة شاملة بجميع المصطلحات والتعريفات والقوانين والقواعد في المنهج كاملاً.
رتّبها أبجدياً وأعدها كـ JSON: {"term": "definition"}""",
        filter_metadata={"curriculum_id": str(curriculum_id)},
    )
    try:
        s = result.find("{"); e = result.rfind("}") + 1
        terms = json.loads(result[s:e]) if s >= 0 else {}
    except Exception:
        terms = {}
    return {"terms": terms}


# ── Helpers ───────────────────────────────────────────────────

def _answers_match(student: str, correct: str, qtype: str) -> bool:
    """Normalise and compare student answer vs correct answer."""
    s = student.strip().lower()
    c = correct.strip().lower()
    if not s:
        return False
    if qtype == "true_false":
        # Accept Arabic synonyms
        true_vals  = {"صح", "صحيح", "true", "1", "نعم", "yes"}
        false_vals = {"خطأ", "خطا", "false", "0", "لا", "no"}
        s_is_true  = s in true_vals
        c_is_true  = c in true_vals
        s_is_false = s in false_vals
        c_is_false = c in false_vals
        if c_is_true:  return s_is_true
        if c_is_false: return s_is_false
    return s == c


async def _get_lesson(lesson_id: uuid.UUID, current_user: User, db: AsyncSession) -> Lesson:
    from app.models.curriculum import Lesson, Curriculum
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    # Students see their teacher's curricula; owners & teachers & admins see own
    if current_user.role == UserRole.ADMIN:
        return lesson
    curr_r = await db.execute(select(Curriculum).where(Curriculum.id == lesson.curriculum_id))
    curriculum = curr_r.scalar_one_or_none()
    if not curriculum:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    if curriculum.owner_id != current_user.id:
        # Students can access if the curriculum belongs to their teacher
        if current_user.role == UserRole.STUDENT and curriculum.owner_id == current_user.teacher_id:
            return lesson
        raise HTTPException(status_code=403, detail="Forbidden")
    return lesson


async def _get_lesson_bare(lesson_id: uuid.UUID, db: AsyncSession) -> Lesson:
    from app.models.curriculum import Lesson
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


async def _get_curriculum(curriculum_id: uuid.UUID, db: AsyncSession) -> Curriculum:
    r = await db.execute(select(Curriculum).where(Curriculum.id == curriculum_id))
    curr = r.scalar_one_or_none()
    if not curr:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curr

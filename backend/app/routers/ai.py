"""AI endpoints — explanation, summary, key terms, question generation, exams with live grading."""
import uuid, json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.user import User, UserRole
from app.models.curriculum import Curriculum, Lesson, Unit, Question, QuestionType
from app.models.exam import (
    QuizAttempt, ExamTypeConfig, ExamType, AttemptStatus, MemorizationProgress
)
from app.models.assignment import Assignment
from app.models.question_bank import SharedQuestion
from app.middleware.auth import get_current_user, check_quota
from app.services import rag_service
from app.services.notification_service import notify

router = APIRouter(prefix="/ai", tags=["AI"])

_OPEN_TYPES = {"why", "essay"}   # AI-graded live in /exam/{id}/check for formative feedback
_MANUAL_TYPES = {"essay"}        # always waits for the teacher at /exam/submit — any type with a blank correct_answer also does, checked separately
_VALID_QUESTION_TYPES = {"mcq", "true_false", "fill_blank", "why", "essay"}
_MAX_CUSTOM_PER_TYPE = 30
_MAX_CUSTOM_TOTAL = 60


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
    # Student-built exam template: pick which question types and how many
    # of each, instead of using the curriculum's configured counts.
    # e.g. {"mcq": 15, "why": 3}
    custom_counts: dict[str, int] | None = None


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

    if body.custom_counts:
        invalid_types = set(body.custom_counts) - _VALID_QUESTION_TYPES
        if invalid_types:
            raise HTTPException(status_code=400, detail=f"أنواع أسئلة غير معروفة: {', '.join(invalid_types)}")
        if any(c < 0 or c > _MAX_CUSTOM_PER_TYPE for c in body.custom_counts.values()):
            raise HTTPException(status_code=400, detail=f"عدد الأسئلة لكل نوع لازم يكون بين 0 و{_MAX_CUSTOM_PER_TYPE}")
        total = sum(body.custom_counts.values())
        if total == 0:
            raise HTTPException(status_code=400, detail="اختر نوع سؤال واحد على الأقل")
        if total > _MAX_CUSTOM_TOTAL:
            raise HTTPException(status_code=400, detail=f"إجمالي الأسئلة لازم يكون {_MAX_CUSTOM_TOTAL} أو أقل")

    return await _create_attempt_for_student(
        db, current_user, body.curriculum_id, body.exam_type, body.lesson_id, body.unit_id,
        custom_counts=body.custom_counts,
    )


async def _bank_questions_for_type(
    db: AsyncSession,
    curriculum_id: uuid.UUID,
    teacher_id: uuid.UUID | None,
    lesson_id: uuid.UUID | None,
    unit_id: uuid.UUID | None,
    qtype: str,
    count: int,
) -> list[dict]:
    """Pull up to `count` questions of one type from the teacher's stored
    banks — verbatim-extracted exam questions (Question, linked to a
    content_type="exam" curriculum) and the shared question bank
    (SharedQuestion) — scoped to this curriculum/unit/lesson. Whatever's
    still missing is generated fresh by the caller.

    A question is included even with a blank correct_answer (e.g. extracted
    from an exam paper that never printed one) — /exam/submit and
    /exam/{id}/check both know to route those to the teacher instead of
    auto-grading them, rather than the system silently dropping/replacing
    them with an AI-generated substitute."""
    if count <= 0:
        return []
    found: list[dict] = []

    try:
        q_type_enum = QuestionType(qtype)
    except ValueError:
        q_type_enum = None

    if q_type_enum:
        q_query = select(Question).where(
            Question.curriculum_id == curriculum_id,
            Question.question_type == q_type_enum,
        )
        if lesson_id:
            q_query = q_query.where(Question.lesson_id == lesson_id)
        elif unit_id:
            q_query = q_query.where(Question.unit_id == unit_id)
        q_query = q_query.order_by(func.random()).limit(count)
        r = await db.execute(q_query)
        for row in r.scalars().all():
            found.append({
                "type": row.question_type.value,
                "question": row.question_text,
                "options": row.options,
                "correct_answer": row.correct_answer,
                "explanation": row.explanation,
            })

    remaining = count - len(found)
    if remaining > 0 and teacher_id:
        sq_query = select(SharedQuestion).where(
            SharedQuestion.teacher_id == teacher_id,
            SharedQuestion.curriculum_id == curriculum_id,
            SharedQuestion.question_type == qtype,
        )
        if lesson_id:
            sq_query = sq_query.where(SharedQuestion.lesson_id == lesson_id)
        elif unit_id:
            sq_query = sq_query.where(SharedQuestion.unit_id == unit_id)
        sq_query = sq_query.order_by(func.random()).limit(remaining)
        r2 = await db.execute(sq_query)
        for row in r2.scalars().all():
            found.append({
                "type": row.question_type,
                "question": row.question,
                "options": row.options,
                "correct_answer": row.correct_answer,
                "explanation": row.explanation,
            })

    return found


async def _create_attempt_for_student(
    db: AsyncSession,
    student: User,
    curriculum_id: uuid.UUID,
    exam_type: ExamType,
    lesson_id: uuid.UUID | None,
    unit_id: uuid.UUID | None,
    assignment_id: uuid.UUID | None = None,
    custom_counts: dict[str, int] | None = None,
    time_limit_override: int | None = None,
) -> dict:
    """Generate questions and create the QuizAttempt — shared by the
    student self-service /exam/create and the assignment-start endpoint
    (backend/app/routers/assignments.py), which passes assignment_id.

    custom_counts (student self-service only): overrides the configured
    per-type question counts with the student's own picks, e.g. building a
    custom exam template — {"mcq": 15, "why": 3}.

    time_limit_override (assignment-start only): a per-assignment minute
    count that overrides the curriculum's configured ExamTypeConfig, so a
    teacher can give this one specific exam a different duration."""
    curriculum = await _get_curriculum(curriculum_id, db)

    # Load exam config (curriculum-specific or global)
    cfg_q = select(ExamTypeConfig).where(
        ExamTypeConfig.exam_type == exam_type,
        ExamTypeConfig.curriculum_id == curriculum_id
    )
    result = await db.execute(cfg_q)
    config = result.scalar_one_or_none()

    if not config:
        # fall back to global default
        result = await db.execute(
            select(ExamTypeConfig).where(
                ExamTypeConfig.exam_type == exam_type,
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

    if custom_counts:
        counts = {t: custom_counts.get(t, 0) for t in ("mcq", "true_false", "fill_blank", "why", "essay")}

    if time_limit_override is not None:
        time_limit = time_limit_override

    # Generate questions for each type
    filter_meta = {"curriculum_id": str(curriculum_id)}
    if lesson_id:
        filter_meta["lesson_id"] = str(lesson_id)
    elif unit_id:
        filter_meta["unit_id"] = str(unit_id)

    all_questions = []
    for qtype, count in counts.items():
        if count > 0:
            bank_qs = await _bank_questions_for_type(
                db, curriculum_id, curriculum.owner_id, lesson_id, unit_id, qtype, count
            )
            remaining = count - len(bank_qs)
            ai_qs = []
            if remaining > 0:
                ai_qs = await rag_service.generate_questions(
                    _get_collection(curriculum),
                    question_types=[qtype],
                    filter_metadata=filter_meta,
                    count=remaining,
                    difficulty=difficulty,
                )
            qs = bank_qs + ai_qs
            # attach points and index
            for q in qs:
                q["points"] = points_map.get(qtype, 2.0)
            all_questions.extend(qs)

    # Attach sequential index
    for i, q in enumerate(all_questions):
        q["index"] = i

    config_snapshot = {
        "exam_type": exam_type.value,
        "time_limit_minutes": time_limit,
        "pass_threshold": pass_threshold,
        "points_map": points_map,
        "counts": counts,
        "difficulty": difficulty,
    }

    attempt = QuizAttempt(
        student_id=student.id,
        curriculum_id=curriculum_id,
        teacher_id=student.teacher_id,
        exam_type=exam_type,
        lesson_id=lesson_id,
        unit_id=unit_id,
        assignment_id=assignment_id,
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


async def _ai_grade_open_answer(question_text: str, model_answer: str, student_answer: str, max_pts: float) -> tuple[float, str]:
    """Grade one open (essay/why) answer with the same LLM-scoring prompt
    pattern as teacher.py's ai_suggest_grades — but used here to FINALIZE a
    score immediately (assignment.auto_reveal_score=True), not just suggest
    one for a teacher to confirm."""
    if not student_answer:
        return 0.0, "لم يُجب الطالب على هذا السؤال"

    prompt = f"""أنت معلم خبير تصحح إجابات الطلاب.

السؤال: {question_text}

الإجابة النموذجية: {model_answer or "غير متوفرة"}

إجابة الطالب: {student_answer}

الدرجة القصوى: {max_pts}

قيّم إجابة الطالب وأعطِ:
1. درجة مقترحة (رقم من 0 إلى {max_pts})
2. تبرير مختصر للدرجة (جملة أو جملتان بالعربية)

أجب بهذا التنسيق بالضبط:
SCORE: [الرقم]
REASON: [التبرير]"""

    try:
        from openai import AsyncOpenAI
        from app.config import settings as _settings
        _ai = AsyncOpenAI(api_key=_settings.OPENAI_API_KEY)
        resp = await _ai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.2,
        )
        text = resp.choices[0].message.content.strip()
        score_line = next((l for l in text.splitlines() if l.startswith("SCORE:")), "")
        reason_line = next((l for l in text.splitlines() if l.startswith("REASON:")), "")
        try:
            score = float(score_line.replace("SCORE:", "").strip())
            score = max(0.0, min(score, float(max_pts)))
        except ValueError:
            score = max_pts / 2
        reasoning = reason_line.replace("REASON:", "").strip() or "الإجابة مقبولة"
        return round(score, 1), reasoning
    except Exception:
        return round(max_pts / 2, 1), "تعذّر التصحيح التلقائي — اقتُرحت منتصف الدرجة"


async def _ai_explain_mistake(question_text: str, student_answer: str, correct_answer: str) -> str:
    """One short sentence explaining why the student's specific wrong
    answer is wrong — used for instant per-question feedback (practice
    mode and live exam feedback), not for scoring."""
    if not student_answer:
        return "لم تُجب على هذا السؤال"
    prompt = f"""السؤال: {question_text}
إجابة الطالب: {student_answer}
الإجابة الصحيحة: {correct_answer}

في جملة واحدة قصيرة بالعربية، وضّح للطالب ليه إجابته دي غلط بالتحديد."""
    try:
        from openai import AsyncOpenAI
        from app.config import settings as _settings
        _ai = AsyncOpenAI(api_key=_settings.OPENAI_API_KEY)
        resp = await _ai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return ""


class CheckAnswerRequest(BaseModel):
    q_index: int
    answer: str


@router.post("/exam/{attempt_id}/check")
async def check_answer(
    attempt_id: uuid.UUID,
    body: CheckAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grade a single question immediately for live feedback while the
    student is still working through the attempt (practice or exam) —
    shows correct/incorrect plus the reasoning for both. Purely a UX
    convenience: does not touch scoring/status, which /exam/submit still
    computes authoritatively at the end.

    A question with no known correct answer (e.g. extracted from an exam
    paper that never printed one) is never auto-graded, live or final — the
    system doesn't invent an answer to check against, so it tells the
    student their teacher will grade it instead of guessing right/wrong."""
    r = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.student_id == current_user.id,
            QuizAttempt.status == AttemptStatus.IN_PROGRESS,
        )
    )
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found or already submitted")

    questions = attempt.questions
    if body.q_index < 0 or body.q_index >= len(questions):
        raise HTTPException(status_code=400, detail="Invalid question index")

    q = questions[body.q_index]
    qtype = q.get("type", "mcq")
    correct_ans = _stringify_answer(q.get("correct_answer", ""))
    max_pts = float(q.get("points", 2.0))
    student_ans = (body.answer or "").strip()

    # Persist progress so a refresh mid-attempt doesn't lose answered questions.
    answers = dict(attempt.answers or {})
    answers[str(body.q_index)] = student_ans
    attempt.answers = answers

    if not correct_ans.strip():
        await db.commit()
        return {
            "is_correct": None,
            "correct_answer": "",
            "explanation": q.get("explanation"),
            "why_wrong": None,
            "points_earned": None,
            "max_points": max_pts,
            "pending_review": True,
        }

    if qtype in _OPEN_TYPES:
        score, reasoning = await _ai_grade_open_answer(q.get("question", ""), correct_ans, student_ans, max_pts)
        is_correct = score >= max_pts * 0.6
        await db.commit()
        return {
            "is_correct": is_correct,
            "correct_answer": correct_ans,
            "explanation": q.get("explanation"),
            "why_wrong": None if is_correct else reasoning,
            "points_earned": score,
            "max_points": max_pts,
        }

    is_correct = _answers_match(student_ans, correct_ans, qtype)
    why_wrong = None if is_correct else await _ai_explain_mistake(q.get("question", ""), student_ans, correct_ans)
    await db.commit()
    return {
        "is_correct": is_correct,
        "correct_answer": correct_ans,
        "explanation": q.get("explanation"),
        "why_wrong": why_wrong,
        "points_earned": max_pts if is_correct else 0.0,
        "max_points": max_pts,
    }


@router.post("/exam/submit")
async def submit_exam(
    body: ExamSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Grade submitted answers instantly wherever a real answer exists: closed
    types (mcq/true_false/fill_blank) are compared exactly and "why" is
    graded via AI. Essay always needs the teacher — and so does any question
    of any type whose source never had a known correct answer (e.g.
    extracted from an exam paper that printed none): the system never
    invents one to grade against, so that question is flagged for manual
    review just like essay."""
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
        correct_ans = _stringify_answer(q.get("correct_answer", ""))

        if qtype in _MANUAL_TYPES or not correct_ans.strip():
            # Essay always, or any type with no known correct answer to
            # grade against — flag for the teacher instead of guessing.
            question_results.append({
                "q_index": idx,
                "type": qtype,
                "question": q.get("question"),
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": None,
                "points_earned": None,
                "max_points": max_pts,
                "needs_manual": True,
                "explanation": q.get("explanation"),
                "options": q.get("options"),
                "why_wrong": None,
            })
            needs_manual = True
        elif qtype in _OPEN_TYPES:
            # "why": open-ended but gradeable instantly via AI — no teacher wait
            score, reasoning = await _ai_grade_open_answer(q.get("question", ""), correct_ans, student_ans, max_pts)
            is_correct = score >= max_pts * 0.6
            auto_score += score
            question_results.append({
                "q_index": idx,
                "type": qtype,
                "question": q.get("question"),
                "student_answer": student_ans,
                "correct_answer": correct_ans,
                "is_correct": is_correct,
                "points_earned": score,
                "max_points": max_pts,
                "needs_manual": False,
                "explanation": q.get("explanation"),
                "why_wrong": None if is_correct else reasoning,
            })
        else:
            # Auto-grade: normalise and compare
            is_correct = _answers_match(student_ans, correct_ans, qtype)
            pts = max_pts if is_correct else 0.0
            auto_score += pts
            why_wrong = None if is_correct else await _ai_explain_mistake(q.get("question", ""), student_ans, correct_ans)
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
                "why_wrong": why_wrong,
            })

    attempt.question_results = question_results
    attempt.auto_score = auto_score
    attempt.max_score = attempt.max_score or sum(q.get("points", 2.0) for q in attempt.questions)

    # If this attempt came from a teacher-created assignment with
    # auto_reveal_score, grade any open questions immediately via AI and
    # finalize — the student sees their full result right away instead of
    # waiting on the teacher's manual review.
    auto_reveal = False
    if needs_manual and attempt.assignment_id:
        r_assign = await db.execute(select(Assignment).where(Assignment.id == attempt.assignment_id))
        assignment = r_assign.scalar_one_or_none()
        auto_reveal = bool(assignment and assignment.auto_reveal_score)

    if needs_manual and auto_reveal:
        manual_total = 0.0
        for res in question_results:
            if not res.get("needs_manual"):
                continue
            idx = res["q_index"]
            q_text = attempt.questions[idx].get("question", "") if idx < len(attempt.questions) else ""
            max_pts = res.get("max_points", 5)
            score, reasoning = await _ai_grade_open_answer(
                q_text, res.get("correct_answer", ""), res.get("student_answer", ""), max_pts
            )
            is_correct = score >= max_pts * 0.6
            res["points_earned"] = score
            res["is_correct"] = is_correct
            res["ai_reasoning"] = reasoning
            res["why_wrong"] = None if is_correct else reasoning
            res["needs_manual"] = False
            manual_total += score
        needs_manual = False
        attempt.question_results = question_results
        attempt.manual_score = manual_total
        attempt.total_score = auto_score + manual_total
        pct = (attempt.total_score / attempt.max_score * 100) if attempt.max_score else 0
        attempt.percentage = round(pct, 1)
        attempt.passed = pct >= attempt.config.get("pass_threshold", 60.0)
        attempt.status = AttemptStatus.APPROVED
    elif needs_manual:
        attempt.status = AttemptStatus.NEEDS_REVIEW
        # Total score is partial until teacher grades open questions
        attempt.total_score = auto_score
    else:
        attempt.status = AttemptStatus.SUBMITTED
        attempt.total_score = auto_score
        pct = (auto_score / attempt.max_score * 100) if attempt.max_score else 0
        attempt.percentage = round(pct, 1)
        attempt.passed = pct >= attempt.config.get("pass_threshold", 60.0)

    # Notify the teacher when it's worth their attention: either they
    # specifically assigned this exam (so they care that it was completed),
    # or it still needs their manual grading — not for every self-directed
    # practice attempt a student runs on their own, which would be noisy and
    # mostly irrelevant to the teacher.
    if attempt.teacher_id and (attempt.assignment_id or needs_manual):
        exam_label = {"lesson_practice": "تدريب درس", "unit_practice": "تدريب وحدة", "comprehensive": "امتحان شامل"}.get(attempt.exam_type.value, "اختبار")
        r_student = await db.execute(select(User).where(User.id == attempt.student_id))
        student = r_student.scalar_one_or_none()
        student_name = student.full_name if student else "طالب"
        if needs_manual:
            notif_title = "اختبار بانتظار المراجعة 📋"
            notif_body = f"{student_name} أكمل {exam_label} وفيه أسئلة محتاجة تقييمك"
        else:
            notif_title = "طالب خلّص امتحان ✅"
            notif_body = f"{student_name} أكمل {exam_label} — الدرجة: {attempt.total_score:.1f}/{attempt.max_score:.1f}"
        await notify(
            db,
            user_id=attempt.teacher_id,
            title=notif_title,
            body=notif_body,
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
    lesson = await _get_owned_lesson(lesson_id, current_user, db)
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
    lesson = await _get_owned_lesson(lesson_id, current_user, db)
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
    lesson = await _get_owned_lesson(lesson_id, current_user, db)
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

def _stringify_answer(value) -> str:
    """AI-generated true_false questions sometimes come back with a JSON
    boolean (true/false) instead of a string for correct_answer — normalise
    whatever we got into a plain string before any .strip()/.lower() use."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def _answers_match(student: str, correct: str, qtype: str) -> bool:
    """Normalise and compare student answer vs correct answer."""
    s = _stringify_answer(student).strip().lower()
    c = _stringify_answer(correct).strip().lower()
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


async def _get_owned_lesson(lesson_id: uuid.UUID, current_user: User, db: AsyncSession) -> Lesson:
    """Like _get_lesson, but only the owning teacher (or admin) may proceed.
    For write operations (set/remove video, reset flashcards) that touch
    content shared by the whole class — a student must not be able to
    trigger these just because they're allowed to view the lesson."""
    from app.models.curriculum import Lesson, Curriculum
    r = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = r.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if current_user.role == UserRole.ADMIN:
        return lesson
    curr_r = await db.execute(select(Curriculum).where(Curriculum.id == lesson.curriculum_id))
    curriculum = curr_r.scalar_one_or_none()
    if not curriculum or curriculum.owner_id != current_user.id:
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

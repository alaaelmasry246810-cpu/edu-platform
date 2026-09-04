"""Export endpoints — generate printable PDF of exam attempts."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import QuizAttempt
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/export", tags=["Export"])


def _html_escape(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _build_exam_html(attempt: any, student_name: str, include_answers: bool = False) -> str:
    """Build a printable HTML document for an exam attempt."""
    questions = attempt.questions or []
    exam_type_labels = {
        "lesson_practice": "تدريب على درس",
        "unit_practice": "تدريب على وحدة",
        "comprehensive": "امتحان شامل",
    }
    exam_label = exam_type_labels.get(attempt.exam_type.value, attempt.exam_type.value)

    q_type_labels = {
        "mcq": "اختيار من متعدد",
        "true_false": "صح أو خطأ",
        "fill_blank": "أكمل الفراغ",
        "why": "علّل",
        "essay": "مقالي",
    }

    questions_html = ""
    for i, q in enumerate(questions):
        qtype = q.get("type", "mcq")
        qtext = _html_escape(q.get("question", f"سؤال {i+1}"))
        pts = q.get("points", 2)
        type_label = q_type_labels.get(qtype, qtype)
        result = None
        if attempt.question_results:
            result = next((r for r in attempt.question_results if r.get("q_index") == i), None)

        options_html = ""
        if qtype == "mcq" and q.get("options"):
            opts = q["options"]
            for j, opt in enumerate(opts):
                letter = chr(0x0623 + j)  # Arabic letters أ ب ج د
                is_correct = include_answers and result and _html_escape(opt) == _html_escape(result.get("correct_answer", ""))
                is_student = include_answers and result and _html_escape(opt) == _html_escape(result.get("student_answer", ""))
                marker = ""
                if is_correct: marker = " ✅"
                elif is_student and not is_correct: marker = " ❌"
                options_html += f'<div class="option">{letter}) {_html_escape(opt)}{marker}</div>'
        elif qtype == "true_false":
            options_html = '<div class="tf-opts"><span>☐ صح</span><span>☐ خطأ</span></div>'

        answer_html = ""
        if include_answers and result:
            student_ans = _html_escape(result.get("student_answer", "—"))
            correct_ans = _html_escape(result.get("correct_answer", ""))
            is_correct = result.get("is_correct")
            pts_earned = result.get("points_earned")
            status_icon = "✅" if is_correct else ("❓" if is_correct is None else "❌")
            answer_html = f"""
            <div class="answer-block">
              <div class="student-ans"><strong>إجابة الطالب:</strong> {student_ans} {status_icon}</div>
              {f'<div class="correct-ans"><strong>الإجابة الصحيحة:</strong> {correct_ans}</div>' if correct_ans else ''}
              {f'<div class="pts"><strong>الدرجة:</strong> {pts_earned if pts_earned is not None else "—"} / {pts}</div>' if pts_earned is not None else ''}
            </div>"""
        elif not include_answers and qtype in ("why", "essay"):
            lines = max(3, min(8, int(pts)))
            answer_html = "".join(['<div class="write-line"></div>' for _ in range(lines)])

        questions_html += f"""
        <div class="question">
          <div class="q-header">
            <span class="q-num">({i+1})</span>
            <span class="q-type">{type_label}</span>
            <span class="q-pts">{pts} درجة</span>
          </div>
          <div class="q-text">{qtext}</div>
          {options_html}
          {answer_html}
        </div>"""

    score_section = ""
    if include_answers and attempt.total_score is not None:
        pct = attempt.percentage or 0
        passed_text = "ناجح ✅" if attempt.passed else "راسب ❌"
        score_section = f"""
        <div class="score-banner {'pass' if attempt.passed else 'fail'}">
          <strong>النتيجة:</strong> {attempt.total_score:.1f} / {attempt.max_score:.1f} ({pct}%) — {passed_text}
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>{'ورقة إجابات' if include_answers else 'ورقة الاختبار'} — {_html_escape(student_name)}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 14px; color: #1a1a2e; background: #fff; direction: rtl; }}
    .page {{ max-width: 800px; margin: 0 auto; padding: 32px; }}
    .header {{ border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }}
    .header h1 {{ font-size: 22px; color: #1e3a5f; margin-bottom: 6px; }}
    .meta {{ display: flex; gap: 24px; font-size: 12px; color: #555; flex-wrap: wrap; }}
    .meta span {{ display: flex; align-items: center; gap: 4px; }}
    .question {{ border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; page-break-inside: avoid; }}
    .q-header {{ display: flex; align-items: center; gap-8px; margin-bottom: 8px; color: #555; font-size: 12px; gap: 10px; }}
    .q-num {{ font-weight: 900; font-size: 15px; color: #2563eb; }}
    .q-type {{ background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 20px; font-size: 11px; }}
    .q-pts {{ margin-right: auto; background: #f0fdf4; color: #15803d; padding: 2px 8px; border-radius: 20px; font-size: 11px; }}
    .q-text {{ font-size: 14px; line-height: 1.7; margin-bottom: 10px; font-weight: 500; }}
    .option {{ margin: 6px 0 6px 16px; font-size: 13px; color: #374151; }}
    .tf-opts {{ display: flex; gap: 24px; margin: 8px 0 8px 16px; font-size: 13px; }}
    .write-line {{ border-bottom: 1px solid #cbd5e1; margin: 8px 0; height: 24px; }}
    .answer-block {{ background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin-top: 10px; font-size: 12px; }}
    .student-ans {{ margin-bottom: 4px; }}
    .correct-ans {{ color: #15803d; margin-bottom: 4px; }}
    .pts {{ color: #2563eb; font-weight: 600; }}
    .score-banner {{ text-align: center; padding: 16px; border-radius: 10px; margin-bottom: 20px; font-size: 16px; }}
    .score-banner.pass {{ background: #f0fdf4; border: 2px solid #22c55e; color: #15803d; }}
    .score-banner.fail {{ background: #fff1f2; border: 2px solid #f87171; color: #b91c1c; }}
    @media print {{ body {{ font-size: 12px; }} .page {{ padding: 16px; }} }}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>{'ورقة إجابات — ' if include_answers else ''}{'الاختبار'}</h1>
      <div class="meta">
        <span>👤 الطالب: <strong>{_html_escape(student_name)}</strong></span>
        <span>📝 النوع: <strong>{exam_label}</strong></span>
        <span>📊 الدرجة الكلية: <strong>{attempt.max_score:.1f}</strong></span>
        {f'<span>⏱️ الوقت: <strong>{attempt.config.get("time_limit_minutes", "—")} دقيقة</strong></span>' if attempt.config else ''}
      </div>
    </div>
    {score_section}
    {questions_html}
    <div style="text-align:center;margin-top:32px;color:#94a3b8;font-size:11px;">منصة المناهج الذكية 🎓</div>
  </div>
</body>
</html>"""


@router.get("/attempt/{attempt_id}/pdf")
async def export_attempt_pdf(
    attempt_id: uuid.UUID,
    answers: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export exam attempt as printable HTML (downloads as .html, print to PDF from browser)."""
    r = await db.execute(select(QuizAttempt).where(QuizAttempt.id == attempt_id))
    attempt = r.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Students can only export their own; teachers can export their students'; admins all
    if current_user.role == UserRole.STUDENT and attempt.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.role == UserRole.TEACHER and attempt.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    from sqlalchemy import select as sel
    from app.models.user import User as UserModel
    rs = await db.execute(sel(UserModel).where(UserModel.id == attempt.student_id))
    student = rs.scalar_one_or_none()
    student_name = student.full_name if student else "طالب"

    html = _build_exam_html(attempt, student_name, include_answers=answers)
    filename = f"exam_{attempt_id.hex[:8]}{'_answers' if answers else ''}.html"

    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

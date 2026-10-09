"use client";
import { useState, useEffect, useRef } from "react";
import { aiAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import Timer from "./Timer";
import type { CheckFeedback, ExamData, ExamResult } from "./types";

export default function ActiveExam({ exam, onSubmit }: { exam: ExamData; onSubmit: (result: ExamResult) => void }) {
  const { t, dir } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, CheckFeedback>>({});
  const [checking, setChecking] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const startTime = useRef(Date.now());

  useEffect(() => {
    aiAPI.aiAssistStatus()
      .then(({ data }) => setAiAssistEnabled(data.ai_assist_enabled ?? false))
      .catch(() => {});
  }, []);

  // Clear hint when question changes
  useEffect(() => { setHint(null); }, [currentIdx]);

  const q = exam.questions[currentIdx];
  const totalQ = exam.questions.length;
  const answered = Object.keys(answers).length;
  const fb = feedback[q.index];

  const setAnswer = (val: string) => setAnswers(prev => ({ ...prev, [q.index]: val }));

  const checkCurrent = async (val: string) => {
    if (checking || fb) return;
    setAnswer(val);
    setChecking(true);
    try {
      const { data } = await aiAPI.checkAnswer(exam.attempt_id, { q_index: q.index, answer: val });
      setFeedback(prev => ({ ...prev, [q.index]: data }));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.exam.active.checkError"));
    } finally {
      setChecking(false);
    }
  };

  const getHint = async () => {
    setHintLoading(true);
    setHint(null);
    try {
      const { data } = await aiAPI.examHint({
        question_text: q.question,
        question_type: q.type,
        options: q.options,
      });
      setHint(data.hint);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.exam.active.hintError"));
    } finally {
      setHintLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        attempt_id: exam.attempt_id,
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [String(k), v])),
        time_taken_seconds: Math.round((Date.now() - startTime.current) / 1000),
      };
      const { data } = await aiAPI.submitExam(payload);
      onSubmit(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.exam.active.submitError"));
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-sm font-medium text-slate-500">
          {t("dashboard.exam.active.questionCounter", { current: currentIdx + 1, total: totalQ })}
          <span className="mr-3 text-xs text-slate-400">{t("dashboard.exam.active.answersCount", { count: answered })}</span>
        </div>
        {exam.time_limit_seconds > 0 && (
          <Timer seconds={exam.time_limit_seconds} onExpire={handleSubmit} />
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-6">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((currentIdx + 1) / totalQ) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-4">
        {/* Type badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg">
            {q.type?.toUpperCase()}
          </span>
          <span className="text-xs text-slate-400">{q.points} {t("dashboard.exam.active.points")}</span>
        </div>

        <p className="font-semibold text-slate-800 dark:text-slate-100 text-base leading-relaxed mb-5">{q.question}</p>

        {/* MCQ Options */}
        {q.type === "mcq" && q.options && (
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const letter = ["أ", "ب", "ج", "د"][i] ?? String(i + 1);
              const selected = answers[q.index] === opt;
              let stateClasses = selected
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-300";
              if (fb && fb.pending_review) {
                stateClasses = selected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-60";
              } else if (fb) {
                if (opt === fb.correct_answer) stateClasses = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-bold";
                else if (opt === answers[q.index]) stateClasses = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through";
                else stateClasses = "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-60";
              }
              return (
                <button
                  key={i}
                  onClick={() => checkCurrent(opt)}
                  disabled={!!fb || checking}
                  className={clsx("w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all", stateClasses)}
                >
                  <span className={clsx("font-bold text-xs w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0",
                    selected ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-500"
                  )}>{letter}</span>
                  {opt}
                  {fb && !fb.pending_review && opt === fb.correct_answer && <span className="mr-auto">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* True / False */}
        {q.type === "true_false" && (
          <div className="flex gap-3">
            {[{ val: "صح", label: t("dashboard.exam.active.trueLabel"), icon: "✓", color: "green" }, { val: "خطأ", label: t("dashboard.exam.active.falseLabel"), icon: "✗", color: "red" }].map(({ val, label, icon, color }) => {
              const selected = answers[q.index] === val;
              let stateClasses = selected
                ? color === "green"
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700"
                  : "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700"
                : "border-slate-200 dark:border-slate-600 text-slate-600 hover:border-slate-300";
              if (fb && fb.pending_review) {
                stateClasses = selected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700"
                  : "border-slate-200 dark:border-slate-600 text-slate-400 opacity-60";
              } else if (fb) {
                if (val === fb.correct_answer) stateClasses = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-bold";
                else if (val === answers[q.index]) stateClasses = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through";
                else stateClasses = "border-slate-200 dark:border-slate-600 text-slate-400 opacity-60";
              }
              return (
                <button
                  key={val}
                  onClick={() => checkCurrent(val)}
                  disabled={!!fb || checking}
                  className={clsx("flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all", stateClasses)}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank / Why / Essay */}
        {["fill_blank", "why", "essay"].includes(q.type) && (
          <div>
            <textarea
              rows={q.type === "essay" ? 6 : 3}
              placeholder={q.type === "fill_blank" ? t("dashboard.exam.active.fillBlankPlaceholder") : t("dashboard.exam.active.essayPlaceholder")}
              value={answers[q.index] || ""}
              onChange={e => setAnswer(e.target.value)}
              disabled={!!fb}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
            />
            {!fb && (
              <button
                onClick={() => checkCurrent(answers[q.index] || "")}
                disabled={checking || !(answers[q.index] || "").trim()}
                className="mt-2 text-sm font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
              >
                {checking ? t("dashboard.exam.active.checking") : t("dashboard.exam.active.checkButton")}
              </button>
            )}
          </div>
        )}

        {/* Instant feedback panel */}
        {fb && fb.pending_review && (
          <div className="mt-4 rounded-xl border-2 p-4 text-center bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-700">
            <div className="font-bold text-sm text-amber-700 dark:text-amber-300">
              {t("dashboard.exam.active.pendingReviewFeedback")}
            </div>
          </div>
        )}
        {fb && !fb.pending_review && (
          <div className={clsx(
            "mt-4 rounded-xl border-2 p-4 text-center",
            fb.is_correct ? "bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-700" : "bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-700"
          )}>
            <div className={clsx("font-bold text-sm mb-1", fb.is_correct ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")}>
              {fb.is_correct ? t("dashboard.exam.active.correctFeedback") : t("dashboard.exam.active.wrongFeedback")}
            </div>
            {!fb.is_correct && (
              <div className="text-sm mb-1">
                <span className="text-slate-500 text-xs">{t("dashboard.exam.results.correctAnswer")} </span>
                <span className="font-bold text-green-700 dark:text-green-400">{fb.correct_answer}</span>
              </div>
            )}
            {!fb.is_correct && fb.why_wrong && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                <span className="font-semibold">{t("dashboard.exam.active.whyWrongLabel")}</span> {fb.why_wrong}
              </p>
            )}
            {fb.explanation && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                <span className="font-semibold">{t("dashboard.exam.active.whyCorrectLabel")}</span> {fb.explanation}
              </p>
            )}
          </div>
        )}

        {/* AI Hint — only if teacher enabled it for this student */}
        {aiAssistEnabled && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={getHint}
              disabled={hintLoading}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                hintLoading
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-400 cursor-wait"
                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              )}
            >
              {hintLoading ? (
                <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>💡</span>
              )}
              {hintLoading ? t("dashboard.exam.active.hintThinking") : hint ? t("dashboard.exam.active.hintAnother") : t("dashboard.exam.active.hintAsk")}
            </button>

            {hint && (
              <div className="mt-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <span className="text-purple-500 text-lg flex-shrink-0">🤖</span>
                  <div>
                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">{t("dashboard.exam.active.hintTitle")}</p>
                    <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{hint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("dashboard.exam.active.prev")}
          </button>
          <button
            onClick={() => setCurrentIdx(i => Math.min(totalQ - 1, i + 1))}
            disabled={currentIdx === totalQ - 1}
            className="px-4 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("dashboard.exam.active.next")}
          </button>
        </div>

        {/* Dot navigation */}
        <div className="flex gap-1 overflow-x-auto max-w-xs">
          {exam.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={clsx(
                "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all",
                i === currentIdx ? "bg-blue-600 w-4" :
                answers[exam.questions[i].index] !== undefined ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
              )}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors disabled:opacity-60"
        >
          {submitting ? t("dashboard.exam.active.submitting") : t("dashboard.exam.active.submit")}
        </button>
      </div>
    </div>
  );
}

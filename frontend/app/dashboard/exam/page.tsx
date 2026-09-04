"use client";
import { useState, useEffect, useRef } from "react";
import { aiAPI, curriculumAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

type ExamType = "lesson_practice" | "unit_practice" | "comprehensive";

interface Question {
  index: number;
  type: string;
  question: string;
  options?: string[];
  points: number;
  explanation?: string;
}

interface QuestionResult {
  q_index: number;
  type: string;
  question?: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean | null;
  points_earned: number | null;
  max_points: number;
  needs_manual: boolean;
  explanation?: string;
  options?: string[];
}

interface ExamData {
  attempt_id: string;
  questions: Question[];
  time_limit_seconds: number;
  max_score: number;
  pass_threshold: number;
}

interface ExamResult {
  attempt_id: string;
  status: string;
  auto_score: number;
  total_score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  needs_manual_grading: boolean;
  question_results: QuestionResult[];
}

// ── Setup Screen ─────────────────────────────────────────────

function ExamSetup({ onStart }: { onStart: (data: { curriculum_id: string; exam_type: ExamType; lesson_id?: string; unit_id?: string }) => void }) {
  const { t, dir } = useI18n();
  const [curricula, setCurricula] = useState<any[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [examType, setExamType] = useState<ExamType>("comprehensive");
  const [loading, setLoading] = useState(false);
  const [adaptive, setAdaptive] = useState<{ difficulty: string; reason: string; avg_percentage: number | null } | null>(null);

  const EXAM_LABELS: Record<ExamType, string> = {
    lesson_practice: t("dashboard.exam.setup.types.lesson_practice"),
    unit_practice: t("dashboard.exam.setup.types.unit_practice"),
    comprehensive: t("dashboard.exam.setup.types.comprehensive"),
  };

  const EXAM_DESCRIPTIONS: Record<ExamType, string> = {
    lesson_practice: t("dashboard.exam.setup.typeDescriptions.lesson_practice"),
    unit_practice: t("dashboard.exam.setup.typeDescriptions.unit_practice"),
    comprehensive: t("dashboard.exam.setup.typeDescriptions.comprehensive"),
  };

  useEffect(() => {
    curriculumAPI.list().then(({ data }) => setCurricula(data.filter((c: any) => c.status === "completed")));
  }, []);

  useEffect(() => {
    if (!curriculumId) { setAdaptive(null); return; }
    aiAPI.adaptiveDifficulty(curriculumId).then(({ data }) => setAdaptive(data)).catch(() => {});
  }, [curriculumId]);

  const handleStart = async () => {
    if (!curriculumId) { toast.error(t("dashboard.exam.setup.selectCurriculumFirst")); return; }
    setLoading(true);
    try {
      onStart({ curriculum_id: curriculumId, exam_type: examType });
    } finally {
      setLoading(false);
    }
  };

  const difficultyBadge: Record<string, { label: string; color: string; emoji: string }> = {
    easy:   { label: t("dashboard.exam.setup.difficulty.easy"),   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",  emoji: "🌱" },
    medium: { label: t("dashboard.exam.setup.difficulty.medium"), color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",  emoji: "⚡" },
    hard:   { label: t("dashboard.exam.setup.difficulty.hard"),   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",          emoji: "🔥" },
  };

  return (
    <div className="max-w-lg mx-auto py-16 px-4" dir={dir}>
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">📝</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("dashboard.exam.setup.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("dashboard.exam.setup.subtitle")}</p>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
        {/* Curriculum */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("dashboard.exam.setup.curriculumLabel")}</label>
          <select
            value={curriculumId}
            onChange={e => setCurriculumId(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t("dashboard.exam.setup.curriculumPlaceholder")}</option>
            {curricula.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Adaptive difficulty banner */}
        {adaptive && (() => {
          const badge = difficultyBadge[adaptive.difficulty] ?? difficultyBadge.medium;
          return (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
              <span className="text-2xl">{badge.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t("dashboard.exam.setup.suggestedLevel")}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{adaptive.reason}</p>
              </div>
            </div>
          );
        })()}

        {/* Exam type */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("dashboard.exam.setup.typeLabel")}</label>
          <div className="grid grid-cols-1 gap-2">
            {(Object.entries(EXAM_LABELS) as [ExamType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => setExamType(type)}
                className={clsx(
                  "text-right px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
                  examType === type
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                )}
              >
                <div className="font-bold">{label}</div>
                <div className="text-xs opacity-70 mt-0.5">
                  {EXAM_DESCRIPTIONS[type]}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={loading || !curriculumId}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? t("dashboard.exam.setup.preparing") : t("dashboard.exam.setup.start")}
        </button>
      </div>
    </div>
  );
}

// ── Timer ─────────────────────────────────────────────────────

function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const pct = remaining / seconds;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const danger = pct < 0.2;

  return (
    <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold",
      danger ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
             : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
    )}>
      ⏱️ {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

// ── Active Exam ───────────────────────────────────────────────

function ActiveExam({ exam, onSubmit }: { exam: ExamData; onSubmit: (result: ExamResult) => void }) {
  const { t, dir } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
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

  const setAnswer = (val: string) => setAnswers(prev => ({ ...prev, [q.index]: val }));

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
              return (
                <button
                  key={i}
                  onClick={() => setAnswer(opt)}
                  className={clsx(
                    "w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm transition-all",
                    selected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                  )}
                >
                  <span className={clsx("font-bold text-xs w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0",
                    selected ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-600 text-slate-500"
                  )}>{letter}</span>
                  {opt}
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
              return (
                <button
                  key={val}
                  onClick={() => setAnswer(val)}
                  className={clsx(
                    "flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all",
                    selected
                      ? color === "green"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 hover:border-slate-300"
                  )}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill blank / Why / Essay */}
        {["fill_blank", "why", "essay"].includes(q.type) && (
          <textarea
            rows={q.type === "essay" ? 6 : 3}
            placeholder={q.type === "fill_blank" ? t("dashboard.exam.active.fillBlankPlaceholder") : t("dashboard.exam.active.essayPlaceholder")}
            value={answers[q.index] || ""}
            onChange={e => setAnswer(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
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

// ── Results Screen ────────────────────────────────────────────

function ExamResults({ result, onRetry }: { result: ExamResult; onRetry: () => void }) {
  const { t, dir } = useI18n();
  const [expanded, setExpanded] = useState<number | null>(null);
  const pct = result.percentage ?? Math.round((result.total_score / result.max_score) * 100);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4" dir={dir}>
      {/* Summary card */}
      <div className={clsx(
        "rounded-2xl p-6 mb-6 text-center border-2",
        result.passed
          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
          : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
      )}>
        <div className="text-5xl mb-2">{result.passed ? "🎉" : "😔"}</div>
        <h2 className={clsx("text-2xl font-black mb-1", result.passed ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
          {result.passed ? t("dashboard.exam.results.passed") : t("dashboard.exam.results.failed")}
        </h2>
        <div className="text-4xl font-black mt-3 mb-1">
          {result.total_score?.toFixed(1)} / {result.max_score?.toFixed(1)}
        </div>
        <div className={clsx("text-lg font-bold", result.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
          {pct?.toFixed(1)}%
        </div>

        {result.needs_manual_grading && (
          <div className="mt-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm px-4 py-2 rounded-xl inline-block">
            {t("dashboard.exam.results.pendingManual")}
          </div>
        )}
      </div>

      {/* Per-question breakdown */}
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{t("dashboard.exam.results.breakdownTitle")}</h3>
      <div className="space-y-3">
        {result.question_results?.map((res, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              className={clsx(
                "border rounded-xl overflow-hidden",
                res.needs_manual ? "border-amber-300 dark:border-amber-700" :
                res.is_correct ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700"
              )}
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-right"
              >
                <span className={clsx("text-lg flex-shrink-0",
                  res.needs_manual ? "text-amber-500" :
                  res.is_correct ? "text-green-600" : "text-red-600"
                )}>
                  {res.needs_manual ? "⏳" : res.is_correct ? "✅" : "❌"}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 text-right line-clamp-1">
                  {res.question || t("dashboard.exam.results.questionFallback", { number: res.q_index + 1 })}
                </span>
                <span className={clsx("text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full",
                  res.needs_manual ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  res.is_correct ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                 : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                )}>
                  {res.points_earned != null ? `${res.points_earned}/${res.max_points}` : `?/${res.max_points}`}
                </span>
                <span className="text-slate-400 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                  {/* Student answer */}
                  <div className="text-sm">
                    <span className="text-slate-500 text-xs">{t("dashboard.exam.results.yourAnswer")} </span>
                    <span className={clsx("font-medium",
                      res.is_correct === null ? "text-slate-700 dark:text-slate-300" :
                      res.is_correct ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    )}>
                      {res.student_answer || "—"}
                    </span>
                  </div>

                  {/* Correct answer */}
                  {!res.is_correct && !res.needs_manual && (
                    <div className="text-sm">
                      <span className="text-slate-500 text-xs">{t("dashboard.exam.results.correctAnswer")} </span>
                      <span className="font-bold text-green-700 dark:text-green-400">{res.correct_answer}</span>
                    </div>
                  )}

                  {/* MCQ options */}
                  {res.options && (
                    <div className="space-y-1 mt-2">
                      {res.options.map((opt, oi) => (
                        <div key={oi} className={clsx(
                          "text-xs px-3 py-1.5 rounded-lg flex items-center gap-2",
                          opt === res.correct_answer ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-bold" :
                          opt === res.student_answer && !res.is_correct ? "bg-red-100 dark:bg-red-900/20 text-red-700 line-through" :
                          "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400"
                        )}>
                          <span>{["أ","ب","ج","د"][oi]}</span> {opt}
                          {opt === res.correct_answer && <span className="mr-auto">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Explanation */}
                  {res.explanation && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 leading-relaxed">
                      💡 {res.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onRetry}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {t("dashboard.exam.results.newExam")}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function ExamPage() {
  const { t, dir } = useI18n();
  const [phase, setPhase] = useState<"setup" | "active" | "results">("setup");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartExam = async (cfg: any) => {
    setLoading(true);
    try {
      const { data } = await aiAPI.createExam(cfg);
      setExam(data);
      setPhase("active");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.exam.createError"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" dir={dir}>
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">{t("dashboard.exam.generating")}</p>
      </div>
    );
  }

  if (phase === "setup") return <ExamSetup onStart={handleStartExam} />;
  if (phase === "active" && exam) return <ActiveExam exam={exam} onSubmit={r => { setResult(r); setPhase("results"); }} />;
  if (phase === "results" && result) return <ExamResults result={result} onRetry={() => { setExam(null); setResult(null); setPhase("setup"); }} />;
  return null;
}

"use client";
import { useState, useEffect } from "react";
import { aiAPI, curriculumAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import ActiveExam from "@/components/exam/ActiveExam";
import ExamResults from "@/components/exam/ExamResults";
import type { ExamData, ExamResult } from "@/components/exam/types";

type ExamType = "lesson_practice" | "unit_practice" | "comprehensive";
type QType = "mcq" | "true_false" | "fill_blank" | "why" | "essay";
const QUESTION_TYPES: QType[] = ["mcq", "true_false", "fill_blank", "why", "essay"];

// ── Setup Screen ─────────────────────────────────────────────

function ExamSetup({ onStart }: { onStart: (data: { curriculum_id: string; exam_type: ExamType; lesson_id?: string; unit_id?: string; custom_counts?: Record<string, number> }) => void }) {
  const { t, dir } = useI18n();
  const [curricula, setCurricula] = useState<any[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [examType, setExamType] = useState<ExamType>("comprehensive");
  const [units, setUnits] = useState<any[]>([]);
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [customTemplate, setCustomTemplate] = useState(false);
  const [counts, setCounts] = useState<Record<QType, number>>({ mcq: 10, true_false: 5, fill_blank: 3, why: 2, essay: 0 });
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

  // Load lesson/unit structure whenever the curriculum changes, needed for
  // lesson_practice / unit_practice scoping.
  useEffect(() => {
    setUnitId(""); setLessonId("");
    if (!curriculumId) { setUnits([]); return; }
    curriculumAPI.structure(curriculumId).then(({ data }) => setUnits(data.units || [])).catch(() => setUnits([]));
  }, [curriculumId]);

  const handleStart = async () => {
    if (!curriculumId) { toast.error(t("dashboard.exam.setup.selectCurriculumFirst")); return; }
    if (examType === "unit_practice" && !unitId) { toast.error(t("dashboard.exam.setup.selectUnitFirst")); return; }
    if (examType === "lesson_practice" && !lessonId) { toast.error(t("dashboard.exam.setup.selectLessonFirst")); return; }
    if (examType === "comprehensive" && customTemplate && Object.values(counts).every(c => !c)) {
      toast.error(t("dashboard.exam.setup.customTotalError"));
      return;
    }
    setLoading(true);
    try {
      onStart({
        curriculum_id: curriculumId,
        exam_type: examType,
        unit_id: examType === "unit_practice" ? unitId : undefined,
        lesson_id: examType === "lesson_practice" ? lessonId : undefined,
        custom_counts: examType === "comprehensive" && customTemplate ? counts : undefined,
      });
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

        {/* Unit picker (unit_practice) */}
        {examType === "unit_practice" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("dashboard.exam.setup.unitLabel")}</label>
            <select
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("dashboard.exam.setup.unitPlaceholder")}</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
        )}

        {/* Lesson picker (lesson_practice) */}
        {examType === "lesson_practice" && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("dashboard.exam.setup.lessonLabel")}</label>
            <select
              value={lessonId}
              onChange={e => setLessonId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t("dashboard.exam.setup.lessonPlaceholder")}</option>
              {units.map(u => (
                <optgroup key={u.id} label={u.title}>
                  {(u.lessons || []).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Custom question template (comprehensive) */}
        {examType === "comprehensive" && (
          <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={customTemplate} onChange={e => setCustomTemplate(e.target.checked)} className="rounded" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t("dashboard.exam.setup.customTemplateToggle")}</span>
            </label>
            {customTemplate && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">{t("dashboard.exam.setup.customTemplateHint")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {QUESTION_TYPES.map(qt => (
                    <div key={qt} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{t(`dashboard.exam.setup.questionTypes.${qt}`)}</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={counts[qt]}
                        onChange={e => setCounts(prev => ({ ...prev, [qt]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))}
                        className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm text-center bg-white dark:bg-slate-700"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

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

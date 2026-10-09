"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { teacherAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

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

interface AISuggestion {
  suggested_points: number;
  reasoning: string;
}

export default function EvaluatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, dir, locale } = useI18n();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [manualGrades, setManualGrades] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | "needs_revision">("approved");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AISuggestion>>({});
  const [editingAuto, setEditingAuto] = useState<Set<number>>(new Set());

  useEffect(() => {
    teacherAPI.attemptDetail(id)
      .then(({ data }) => {
        setAttempt(data);
        if (data.question_results) {
          const preGrades: Record<string, string> = {};
          data.question_results.forEach((r: QuestionResult) => {
            if (r.points_earned != null) preGrades[String(r.q_index)] = String(r.points_earned);
          });
          setManualGrades(preGrades);
        }
      })
      .catch(() => toast.error(t("teacher.pendingDetail.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAISuggest = async () => {
    setAiLoading(true);
    try {
      const { data } = await teacherAPI.aiSuggest(id);
      setAiSuggestions(data.suggestions || {});
      // Auto-fill grades with suggestions
      const newGrades = { ...manualGrades };
      Object.entries(data.suggestions || {}).forEach(([idx, s]: [string, any]) => {
        newGrades[idx] = String(s.suggested_points);
      });
      setManualGrades(newGrades);
      toast.success(t("teacher.pendingDetail.aiSuggestSuccess"));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.pendingDetail.aiSuggestError"));
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const numericGrades: Record<string, number> = {};
      Object.entries(manualGrades).forEach(([k, v]) => {
        const n = parseFloat(v);
        if (!isNaN(n)) numericGrades[k] = n;
      });
      await teacherAPI.evaluate(id, { manual_grades: numericGrades, comment, decision });
      toast.success(t("teacher.pendingDetail.saveSuccess"));
      router.push("/teacher/pending");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.pendingDetail.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!attempt) return <p className="text-center text-slate-400">{t("teacher.pendingDetail.notFound")}</p>;

  const openQuestions: QuestionResult[] = (attempt.question_results ?? []).filter((r: QuestionResult) => r.needs_manual);
  const autoQuestions: QuestionResult[] = (attempt.question_results ?? []).filter((r: QuestionResult) => !r.needs_manual);

  return (
    <div dir={dir} className="max-w-2xl">
      {/* Back */}
      <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline mb-4 block">{t("teacher.pendingDetail.back")}</button>

      {/* Student & Attempt info */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t("teacher.pendingDetail.examTitle", { name: attempt.student?.full_name })}
          </h1>
          <span className="text-xs text-slate-400">
            {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
          </span>
        </div>
        <div className="flex gap-4 text-sm text-slate-500">
          <span>{t("teacher.pendingDetail.autoScore")} <strong className="text-slate-800 dark:text-slate-200">{attempt.auto_score?.toFixed(1) ?? "—"}</strong></span>
          <span>{t("teacher.pendingDetail.outOf")} <strong className="text-slate-800 dark:text-slate-200">{attempt.max_score?.toFixed(1) ?? "—"}</strong></span>
        </div>
      </div>

      {/* Open questions to grade */}
      {openQuestions.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">{t("teacher.pendingDetail.openSectionTitle")}</h2>
            <button
              onClick={handleAISuggest}
              disabled={aiLoading}
              className="flex items-center gap-2 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl transition-colors disabled:opacity-60 font-medium"
            >
              {aiLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("teacher.pendingDetail.aiAnalyzing")}
                </>
              ) : (
                <>{t("teacher.pendingDetail.aiSuggestBtn")}</>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {openQuestions.map((res) => {
              const suggestion = aiSuggestions[String(res.q_index)];
              return (
                <div key={res.q_index} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">
                      {res.type?.toUpperCase()} · {t("teacher.pendingDetail.question", { n: res.q_index + 1 })}
                    </span>
                    <span className="text-xs text-slate-400">{t("teacher.pendingDetail.maxPoints", { n: res.max_points })}</span>
                  </div>

                  <p className="font-medium text-slate-800 dark:text-slate-200 mb-3 text-sm leading-relaxed">
                    {attempt.questions?.[res.q_index]?.question ?? t("teacher.pendingDetail.question", { n: res.q_index + 1 })}
                  </p>

                  {!!res.options?.length && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {res.options.map((opt, oi) => (
                        <span
                          key={oi}
                          className={clsx(
                            "text-xs px-2.5 py-1 rounded-lg",
                            opt === res.student_answer
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          )}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 mb-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="text-xs text-slate-400 block mb-1">{t("teacher.pendingDetail.studentAnswer")}</span>
                    {res.student_answer || <span className="text-slate-400 italic">{t("teacher.pendingDetail.noAnswer")}</span>}
                  </div>

                  {res.correct_answer && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 mb-3 text-sm text-green-800 dark:text-green-300 leading-relaxed">
                      <span className="text-xs block mb-1">{t("teacher.pendingDetail.modelAnswer")}</span>
                      {res.correct_answer}
                    </div>
                  )}

                  {/* AI Suggestion card */}
                  {suggestion && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">{t("teacher.pendingDetail.aiSuggestionTitle")}</span>
                        <span className="text-xs bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded-full font-mono">
                          {suggestion.suggested_points} / {res.max_points}
                        </span>
                      </div>
                      <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">{suggestion.reasoning}</p>
                      <button
                        onClick={() => setManualGrades(prev => ({ ...prev, [String(res.q_index)]: String(suggestion.suggested_points) }))}
                        className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        {t("teacher.pendingDetail.applySuggestion")}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm text-slate-600 dark:text-slate-400 font-medium">{t("teacher.pendingDetail.gradeLabel")}</label>
                    <input
                      type="number"
                      min={0}
                      max={res.max_points}
                      step={0.5}
                      value={manualGrades[String(res.q_index)] ?? ""}
                      onChange={e => setManualGrades(prev => ({ ...prev, [String(res.q_index)]: e.target.value }))}
                      className="w-24 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700"
                      placeholder={`0 - ${res.max_points}`}
                    />
                    <span className="text-xs text-slate-400">{t("teacher.pendingDetail.outOfShort", { n: res.max_points })}</span>
                    {/* Quick buttons */}
                    {[0, res.max_points / 2, res.max_points].map(v => (
                      <button
                        key={v}
                        onClick={() => setManualGrades(prev => ({ ...prev, [String(res.q_index)]: String(v) }))}
                        className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-graded summary — editable in case the teacher disagrees with one */}
      {autoQuestions.length > 0 && (
        <div className="mb-5">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{t("teacher.pendingDetail.autoGradedTitle")}</h2>
          <div className="space-y-2">
            {autoQuestions.map(res => {
              const isEditing = editingAuto.has(res.q_index);
              return (
                <div key={res.q_index} className={clsx(
                  "px-4 py-2.5 rounded-xl border text-sm",
                  res.is_correct ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-base">{res.is_correct ? "✅" : "❌"}</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-300 truncate">
                      {attempt.questions?.[res.q_index]?.question?.slice(0, 60) ?? t("teacher.pendingDetail.question", { n: res.q_index + 1 })}...
                    </span>
                    {!isEditing && (
                      <button
                        onClick={() => setEditingAuto(prev => new Set(prev).add(res.q_index))}
                        className="text-xs text-slate-400 hover:text-blue-600"
                        title={t("teacher.pendingDetail.overrideScore")}
                      >
                        ✏️
                      </button>
                    )}
                    <span className="font-mono text-xs text-slate-500">
                      {manualGrades[String(res.q_index)] ?? res.points_earned}/{res.max_points}
                    </span>
                  </div>
                  {isEditing && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min={0}
                        max={res.max_points}
                        step={0.5}
                        value={manualGrades[String(res.q_index)] ?? ""}
                        onChange={e => setManualGrades(prev => ({ ...prev, [String(res.q_index)]: e.target.value }))}
                        className="w-24 border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700"
                      />
                      <span className="text-xs text-slate-400">{t("teacher.pendingDetail.outOfShort", { n: res.max_points })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comment & Decision */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("teacher.pendingDetail.commentLabel")}</label>
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t("teacher.pendingDetail.commentPlaceholder")}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t("teacher.pendingDetail.decisionLabel")}</label>
          <div className="flex gap-2">
            {([
              { val: "approved", label: t("teacher.pendingDetail.decisions.approved"), cls: "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700" },
              { val: "rejected", label: t("teacher.pendingDetail.decisions.rejected"), cls: "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700" },
              { val: "needs_revision", label: t("teacher.pendingDetail.decisions.needs_revision"), cls: "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700" },
            ] as const).map(d => (
              <button
                key={d.val}
                onClick={() => setDecision(d.val as any)}
                className={clsx(
                  "flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all",
                  decision === d.val ? d.cls : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {saving ? t("teacher.pendingDetail.saving") : t("teacher.pendingDetail.saveBtn")}
        </button>
      </div>
    </div>
  );
}

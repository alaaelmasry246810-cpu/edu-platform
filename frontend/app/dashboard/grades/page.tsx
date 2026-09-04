"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { aiAPI, exportAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface Attempt {
  attempt_id: string;
  exam_type: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  percentage: number | null;
  passed: boolean | null;
  started_at: string;
  submitted_at: string | null;
}

export default function GradesPage() {
  const { t, dir, locale } = useI18n();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const EXAM_LABELS: Record<string, string> = {
    lesson_practice: t("dashboard.grades.examTypes.lesson_practice"),
    unit_practice:   t("dashboard.grades.examTypes.unit_practice"),
    comprehensive:   t("dashboard.grades.examTypes.comprehensive"),
  };

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    in_progress:  { label: t("dashboard.grades.status.in_progress"),  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    submitted:    { label: t("dashboard.grades.status.submitted"),    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    needs_review: { label: t("dashboard.grades.status.needs_review"), color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    approved:     { label: t("dashboard.grades.status.approved"),     color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    rejected:     { label: t("dashboard.grades.status.rejected"),     color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };

  async function downloadExam(attemptId: string, withAnswers = false) {
    try {
      const { data } = await exportAPI.examHtml(attemptId, withAnswers);
      const url = URL.createObjectURL(new Blob([data], { type: "text/html" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `exam_${attemptId.slice(0, 8)}${withAnswers ? "_answers" : ""}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("dashboard.grades.downloadError"));
    }
  }

  useEffect(() => {
    aiAPI.myAttempts()
      .then(({ data }) => setAttempts(data))
      .catch(() => toast.error(t("dashboard.grades.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const submitted = attempts.filter(a => a.status !== "in_progress");
  const avgPct = submitted.length
    ? submitted.filter(a => a.percentage != null).reduce((s, a) => s + (a.percentage ?? 0), 0)
      / submitted.filter(a => a.percentage != null).length
    : null;
  const passed = submitted.filter(a => a.passed === true).length;

  return (
    <div dir={dir}>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("dashboard.grades.title")} 📊</h1>
          <p className="text-slate-500 text-sm mt-1">{t("dashboard.grades.subtitle")}</p>
        </div>
        <Link
          href="/dashboard/exam"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {t("dashboard.grades.newExam")}
        </Link>
      </div>

      {/* Stats */}
      {submitted.length > 0 && (
        <div className="flex gap-4 mb-6 flex-wrap">
          {[
            { label: t("dashboard.grades.stats.total"), value: submitted.length, color: "text-slate-700 dark:text-slate-200" },
            { label: t("dashboard.grades.stats.passed"), value: passed, color: "text-green-700 dark:text-green-400" },
            { label: t("dashboard.grades.stats.failed"), value: submitted.filter(a => a.passed === false).length, color: "text-red-600 dark:text-red-400" },
            { label: t("dashboard.grades.stats.average"), value: avgPct != null ? `${avgPct.toFixed(1)}%` : "—", color: "text-blue-700 dark:text-blue-400" },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className={clsx("text-xl font-bold", s.color)}>{s.value}</span>
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {attempts.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <div className="text-5xl mb-4">📝</div>
          <p className="text-slate-600 dark:text-slate-400 font-semibold mb-4">{t("dashboard.grades.empty.title")}</p>
          <Link href="/dashboard/exam" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
            {t("dashboard.grades.empty.cta")}
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                <th className="text-right px-4 py-3">{t("dashboard.grades.table.type")}</th>
                <th className="text-right px-4 py-3">{t("dashboard.grades.table.score")}</th>
                <th className="text-right px-4 py-3">{t("dashboard.grades.table.percentage")}</th>
                <th className="text-right px-4 py-3">{t("dashboard.grades.table.status")}</th>
                <th className="text-right px-4 py-3">{t("dashboard.grades.table.date")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map(a => {
                const status = STATUS_CONFIG[a.status] ?? { label: a.status, color: "bg-slate-100 text-slate-600" };
                const pct = a.percentage;
                return (
                  <tr key={a.attempt_id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {EXAM_LABELS[a.exam_type] ?? a.exam_type}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-200">
                      {a.total_score != null ? `${a.total_score?.toFixed(1)} / ${a.max_score?.toFixed(1)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {pct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                            <div
                              className={clsx("h-1.5 rounded-full", pct >= 60 ? "bg-green-500" : "bg-red-500")}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className={clsx("text-xs font-bold", pct >= 60 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.status !== "in_progress" && (
                          <Link
                            href={`/dashboard/exam/result/${a.attempt_id}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {t("dashboard.grades.view")}
                          </Link>
                        )}
                        {a.status !== "in_progress" && (
                          <button
                            onClick={() => downloadExam(a.attempt_id, a.status === "approved")}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            title={t("dashboard.grades.downloadPdf")}
                          >
                            ⬇️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

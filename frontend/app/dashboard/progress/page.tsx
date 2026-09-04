"use client";
import { useEffect, useState } from "react";
import { aiAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";

interface Attempt {
  attempt_id: string;
  exam_type: string;
  status: string;
  percentage: number | null;
  passed: boolean | null;
  total_score: number | null;
  max_score: number | null;
  submitted_at: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  lesson_practice: "#3b82f6",
  unit_practice:   "#8b5cf6",
  comprehensive:   "#f59e0b",
};

function BarChart({ attempts, examLabels, locale, t }: { attempts: Attempt[]; examLabels: Record<string, string>; locale: string; t: (k: string, v?: any) => string }) {
  const finished = attempts
    .filter(a => a.percentage != null && a.submitted_at)
    .sort((a, b) => new Date(a.submitted_at!).getTime() - new Date(b.submitted_at!).getTime())
    .slice(-12);

  if (!finished.length) return <p className="text-slate-400 text-sm text-center py-8">{t("dashboard.progress.noCompletedExams")}</p>;

  const max = 100;

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-2 h-40 min-w-max px-2">
        {finished.map((a, i) => {
          const pct = a.percentage ?? 0;
          const height = Math.max(4, (pct / max) * 140);
          const color = TYPE_COLORS[a.exam_type] ?? "#64748b";
          return (
            <div key={a.attempt_id} className="flex flex-col items-center gap-1" style={{ minWidth: 36 }}>
              <span className="text-xs font-mono text-slate-500">{Math.round(pct)}%</span>
              <div
                className="rounded-t-md w-8 transition-all"
                style={{ height, backgroundColor: color, opacity: a.passed ? 1 : 0.5 }}
                title={`${examLabels[a.exam_type] ?? a.exam_type}: ${pct}%`}
              />
              <span className="text-xs text-slate-400" style={{ fontSize: 9 }}>
                {new Date(a.submitted_at!).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { month: "numeric", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-500">{examLabels[type]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-400 opacity-50" />
          <span className="text-xs text-slate-500">{t("dashboard.progress.failedShort")}</span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ passed, failed, t }: { passed: number; failed: number; t: (k: string) => string }) {
  const total = passed + failed;
  if (!total) return <p className="text-slate-400 text-sm text-center py-6">{t("dashboard.progress.noData")}</p>;
  const pct = Math.round((passed / total) * 100);
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - passed / total);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#22c55e" strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            strokeLinecap="round" className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-800 dark:text-white">{pct}%</span>
          <span className="text-xs text-slate-500">{t("dashboard.progress.success")}</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="text-green-600 font-semibold">✅ {t("dashboard.progress.passedLabel")}: {passed}</span>
        <span className="text-red-500 font-semibold">❌ {t("dashboard.progress.failedLabel")}: {failed}</span>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const { t, dir, locale } = useI18n();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const EXAM_LABELS: Record<string, string> = {
    lesson_practice: t("dashboard.progress.examTypes.lesson_practice"),
    unit_practice:   t("dashboard.progress.examTypes.unit_practice"),
    comprehensive:   t("dashboard.progress.examTypes.comprehensive"),
  };

  useEffect(() => {
    aiAPI.myAttempts()
      .then(({ data }) => setAttempts(data))
      .catch(() => toast.error(t("dashboard.progress.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const finished = attempts.filter(a => a.percentage != null);
  const passed = finished.filter(a => a.passed).length;
  const failed = finished.filter(a => !a.passed).length;
  const avgPct = finished.length ? Math.round(finished.reduce((s, a) => s + (a.percentage ?? 0), 0) / finished.length) : 0;

  const byType: Record<string, { total: number; passed: number; avg: number }> = {};
  for (const a of finished) {
    if (!byType[a.exam_type]) byType[a.exam_type] = { total: 0, passed: 0, avg: 0 };
    byType[a.exam_type].total++;
    if (a.passed) byType[a.exam_type].passed++;
    byType[a.exam_type].avg += a.percentage ?? 0;
  }
  for (const k in byType) {
    byType[k].avg = byType[k].total ? Math.round(byType[k].avg / byType[k].total) : 0;
  }

  // Best and worst
  const bestAttempt = finished.reduce((best, a) => (a.percentage ?? 0) > (best?.percentage ?? -1) ? a : best, finished[0]);
  const worstAttempt = finished.reduce((worst, a) => (a.percentage ?? 100) < (worst?.percentage ?? 101) ? a : worst, finished[0]);

  return (
    <div dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("dashboard.progress.title")} 📈</h1>
        <p className="text-slate-500 text-sm mt-1">{t("dashboard.progress.subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: t("dashboard.progress.cards.completedExams"), value: finished.length, icon: "📝", color: "text-blue-600" },
          { label: t("dashboard.progress.cards.averageScore"),   value: `${avgPct}%`,     icon: "📊", color: "text-purple-600" },
          { label: t("dashboard.progress.cards.passCount"),      value: passed,            icon: "✅", color: "text-green-600" },
          { label: t("dashboard.progress.cards.failCount"),      value: failed,            icon: "❌", color: "text-red-500" },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center">
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-5 mb-5">
        {/* Trend chart */}
        <div className="sm:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4">{t("dashboard.progress.trendChart")}</h2>
          <BarChart attempts={finished} examLabels={EXAM_LABELS} locale={locale} t={t} />
        </div>

        {/* Pass rate donut */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col items-center justify-center">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4">{t("dashboard.progress.passRate")}</h2>
          <DonutChart passed={passed} failed={failed} t={t} />
        </div>
      </div>

      {/* Per exam type breakdown */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-5">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-4">{t("dashboard.progress.byType")}</h2>
        {Object.keys(byType).length === 0
          ? <p className="text-slate-400 text-sm">{t("dashboard.progress.noEnoughData")}</p>
          : (
            <div className="space-y-3">
              {Object.entries(byType).map(([type, stats]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{EXAM_LABELS[type] ?? type}</span>
                    <span className="text-slate-500 text-xs">{stats.passed}/{stats.total} {t("dashboard.progress.passRateSuffix")} {stats.avg}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: `${stats.avg}%`, backgroundColor: TYPE_COLORS[type] ?? "#64748b" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Best / Worst */}
      {finished.length >= 2 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {bestAttempt && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
              <div className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">{t("dashboard.progress.best")}</div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">{bestAttempt.percentage}%</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                {EXAM_LABELS[bestAttempt.exam_type] ?? bestAttempt.exam_type} ·{" "}
                {bestAttempt.submitted_at ? new Date(bestAttempt.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
              </div>
            </div>
          )}
          {worstAttempt && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
              <div className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">{t("dashboard.progress.worst")}</div>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">{worstAttempt.percentage}%</div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                {EXAM_LABELS[worstAttempt.exam_type] ?? worstAttempt.exam_type} ·{" "}
                {worstAttempt.submitted_at ? new Date(worstAttempt.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
              </div>
            </div>
          )}
        </div>
      )}

      {attempts.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📊</div>
          <p>{t("dashboard.progress.empty.title")}</p>
          <p className="text-sm mt-1">{t("dashboard.progress.empty.subtitle")}</p>
        </div>
      )}
    </div>
  );
}

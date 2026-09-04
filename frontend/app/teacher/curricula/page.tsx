"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { curriculumAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface Curriculum {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  total_pages: number;
  created_at: string;
}

const SUBJECT_ICONS: Record<string, string> = {
  "رياضيات": "🔢", "كيمياء": "⚗️", "فيزياء": "⚡", "أحياء": "🧬",
  "تاريخ": "📜", "جغرافيا": "🗺️", "لغة عربية": "📖", "لغة إنجليزية": "🔤",
  "علوم": "🔬", "دين": "☪️", "فلسفة": "🤔",
};

export default function TeacherCurriculaPage() {
  const { t, dir } = useI18n();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const STATUS_CONFIG = {
    pending:    { label: t("dashboard.myCurricula.status.pending"),    color: "bg-slate-100 text-slate-600",  icon: "⏳" },
    processing: { label: t("dashboard.myCurricula.status.processing"), color: "bg-amber-100 text-amber-700",  icon: "⚙️" },
    completed:  { label: t("dashboard.myCurricula.status.completed"),  color: "bg-green-100 text-green-700",  icon: "✅" },
    failed:     { label: t("dashboard.myCurricula.status.failed"),     color: "bg-red-100 text-red-700",      icon: "❌" },
  };

  useEffect(() => {
    const fetchData = () => {
      curriculumAPI.list()
        .then(({ data }) => setCurricula(data))
        .catch(() => toast.error(t("dashboard.myCurricula.loadError")))
        .finally(() => setLoading(false));
    };
    fetchData();
    const interval = setInterval(() => {
      if (curricula.some((c) => c.status === "processing" || c.status === "pending")) {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = curricula.filter((c) =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.subject?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("nav.manageMyCurricula")} 📚</h1>
          <p className="text-slate-500 text-sm mt-1">{t("dashboard.myCurricula.subtitle")}</p>
        </div>
        <Link
          href="/teacher/curricula/upload"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          <span>⬆️</span> {t("dashboard.myCurricula.uploadNew")}
        </Link>
      </div>

      {/* Search */}
      {curricula.length > 0 && (
        <div className="mb-6">
          <input
            type="text"
            placeholder={t("dashboard.myCurricula.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Stats row */}
      {curricula.length > 0 && (
        <div className="flex gap-4 mb-6 flex-wrap">
          {[
            { label: t("dashboard.myCurricula.stats.total"), value: curricula.length, color: "text-slate-700" },
            { label: t("dashboard.myCurricula.stats.ready"), value: curricula.filter(c => c.status === "completed").length, color: "text-green-700" },
            { label: t("dashboard.myCurricula.stats.processing"), value: curricula.filter(c => c.status === "processing" || c.status === "pending").length, color: "text-amber-700" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className={clsx("text-xl font-bold", s.color)}>{s.value}</span>
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {curricula.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-slate-600 dark:text-slate-400 font-semibold text-lg mb-1">{t("dashboard.myCurricula.empty.title")}</p>
          <p className="text-slate-400 text-sm mb-6">{t("dashboard.myCurricula.empty.subtitle")}</p>
          <Link
            href="/teacher/curricula/upload"
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            {t("dashboard.myCurricula.empty.cta")}
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🔍</div>
          <p>{t("dashboard.myCurricula.noResults")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const status = STATUS_CONFIG[c.status];
            const subjectIcon = SUBJECT_ICONS[c.subject ?? ""] ?? "📖";
            const isProcessing = c.status === "processing" || c.status === "pending";
            return (
              <div
                key={c.id}
                className={clsx(
                  "bg-white dark:bg-slate-800 border rounded-2xl p-5 transition-all duration-200",
                  c.status === "completed"
                    ? "border-slate-200 dark:border-slate-700 hover:shadow-lg hover:-translate-y-0.5"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{subjectIcon}</div>
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1", status.color)}>
                    {isProcessing && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    )}
                    {status.icon} {status.label}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-2 text-sm leading-relaxed">
                  {c.title}
                </h3>

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                  {c.subject && <span>{c.subject}</span>}
                  {c.grade_level && <span>· {c.grade_level}</span>}
                  <span>· {c.total_pages} {t("dashboard.myCurricula.pages")}</span>
                </div>

                {/* Action */}
                {c.status === "completed" ? (
                  <Link
                    href={`/dashboard/lessons/${c.id}`}
                    className="block text-center bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {t("dashboard.myCurricula.startStudying")}
                  </Link>
                ) : isProcessing ? (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-2.5">
                    <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-amber-700 dark:text-amber-400">{t("dashboard.myCurricula.aiAnalyzing")}</span>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5 text-xs text-red-600 dark:text-red-400 text-center">
                    {t("dashboard.myCurricula.analysisError")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

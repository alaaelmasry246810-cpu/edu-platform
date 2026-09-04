"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

export default function PendingPage() {
  const { t, dir, locale } = useI18n();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherAPI.pending()
      .then(({ data }) => setPending(data))
      .catch(() => toast.error(t("teacher.pending.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  const examTypeLabel = ({
    lesson_practice: t("teacher.examTypes.lessonPractice"),
    unit_practice: t("teacher.examTypes.unitPractice"),
    comprehensive: t("teacher.examTypes.comprehensive"),
  } as Record<string, string>);

  return (
    <div dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.pending.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("teacher.pending.subtitle")}</p>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-medium">{t("teacher.pending.emptyTitle")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((a: any) => (
            <Link
              key={a.attempt_id}
              href={`/teacher/pending/${a.attempt_id}`}
              className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{a.needs_manual ? "✍️" : "📋"}</span>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">{a.student_name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {examTypeLabel[a.exam_type] ?? a.exam_type}
                      {a.submitted_at && ` · ${new Date(a.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.needs_manual && (
                    <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-full font-medium">
                      {t("teacher.pending.openQuestions")}
                    </span>
                  )}
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-full font-medium">
                    {a.auto_score != null ? `${a.auto_score?.toFixed(1)} / ${a.max_score?.toFixed(1)}` : "—"} {t("teacher.pending.auto")}
                  </span>
                  <span className="text-blue-600 text-sm font-medium">{t("teacher.pending.evaluate")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

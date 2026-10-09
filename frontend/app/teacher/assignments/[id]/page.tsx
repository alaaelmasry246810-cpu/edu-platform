"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import { assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentAPI.detail(id)
      .then(({ data }) => setData(data))
      .catch(() => toast.error(t("teacher.assignments.detail.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return <div className="text-center py-16 text-slate-400">{t("teacher.assignments.detail.notFound")}</div>;

  return (
    <div dir={dir}>
      <Link href="/teacher/assignments" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        {t("teacher.assignments.detail.back")}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{data.title}</h1>
      <p className="text-slate-500 text-sm mb-6">
        {data.kind === "exam" ? t("teacher.assignments.kindExam") : t("teacher.assignments.kindPractice")}
      </p>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 text-xs">
            <tr>
              <th className="text-right px-4 py-3">{t("teacher.assignments.detail.table.student")}</th>
              <th className="text-right px-4 py-3">{t("teacher.assignments.detail.table.status")}</th>
              <th className="text-right px-4 py-3">{t("teacher.assignments.detail.table.score")}</th>
              <th className="text-right px-4 py-3">{t("teacher.assignments.detail.table.submittedAt")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.roster.map((r: any) => (
              <tr key={r.student_id}>
                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{r.full_name}</td>
                <td className="px-4 py-3">
                  {r.last_attempt ? (
                    <span className={clsx(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      r.last_attempt.status === "approved" || r.last_attempt.status === "submitted"
                        ? "bg-green-100 text-green-700"
                        : r.last_attempt.status === "needs_review"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                    )}>
                      {t(`teacher.attemptStatus.${r.last_attempt.status}`)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">{t("teacher.assignments.detail.notStarted")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {r.last_attempt?.percentage != null ? `${r.last_attempt.percentage}%` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {r.last_attempt?.submitted_at ? new Date(r.last_attempt.submitted_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

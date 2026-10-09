"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fmtTime } from "@/components/activities/Leaderboard";
import { teacherAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

export default function StudentAttemptsPage() {
  const { id } = useParams<{ id: string }>();
  const { t, dir, locale } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherAPI.studentAttempts(id)
      .then(({ data }) => setData(data))
      .catch(() => toast.error(t("teacher.studentDetail.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <p className="text-center text-slate-400">{t("teacher.studentDetail.notFound")}</p>;

  const examTypeLabel = ({
    lesson_practice: t("teacher.examTypes.lessonPractice"),
    unit_practice: t("teacher.examTypes.unitPractice"),
    comprehensive: t("teacher.examTypes.comprehensive"),
  } as Record<string, string>);

  const statusMap: Record<string, string> = {
    in_progress: t("teacher.attemptStatus.in_progress"),
    submitted: t("teacher.attemptStatus.submitted"),
    needs_review: t("teacher.attemptStatus.needs_review"),
    approved: t("teacher.attemptStatus.approved"),
    rejected: t("teacher.attemptStatus.rejected"),
  };

  return (
    <div dir={dir}>
      <div className="mb-6">
        <Link href="/teacher/students" className="text-sm text-blue-600 hover:underline">{t("teacher.studentDetail.backToStudents")}</Link>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("teacher.studentDetail.resultsFor", { name: data.student.full_name })}</h1>
          <Link href={`/teacher/students/${id}/schedule`} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">
            📅 {t("teacher.studentDetail.editSchedule")}
          </Link>
        </div>
      </div>

      {data.attempts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📋</div>
          <p>{t("teacher.studentDetail.emptyAttempts")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase">
                <th className="text-right px-4 py-3">{t("teacher.studentDetail.table.examType")}</th>
                <th className="text-right px-4 py-3">{t("teacher.studentDetail.table.score")}</th>
                <th className="text-right px-4 py-3">{t("teacher.studentDetail.table.percentage")}</th>
                <th className="text-right px-4 py-3">{t("teacher.studentDetail.table.status")}</th>
                <th className="text-right px-4 py-3">{t("teacher.studentDetail.table.date")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((a: any) => {
                const pct = a.percentage;
                return (
                  <tr key={a.attempt_id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {examTypeLabel[a.exam_type] ?? a.exam_type}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-200">
                      {a.total_score != null ? `${a.total_score?.toFixed(1)} / ${a.max_score?.toFixed(1)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {pct != null ? (
                        <span className={clsx("text-xs font-bold", pct >= 60 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                          {pct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{statusMap[a.status] ?? a.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.status !== "in_progress" && (
                        <Link href={`/teacher/pending/${a.attempt_id}`} className="text-xs text-blue-600 hover:underline">
                          {["submitted", "needs_review"].includes(a.status) ? t("teacher.studentDetail.evaluate") : t("teacher.studentDetail.view")}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* Games & activities results (assigned, live games, share links) */}
      {(data.activity_attempts ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">🎮 {t("games.records.activityResults")}</h2>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs">
                <tr>
                  <th className="p-3 text-start">{t("games.records.activity")}</th>
                  <th className="p-3">{t("games.leaderboard.correct")}</th>
                  <th className="p-3">{t("games.leaderboard.time")}</th>
                  <th className="p-3">{t("games.leaderboard.score")}</th>
                  <th className="p-3">{t("games.records.date")}</th>
                </tr>
              </thead>
              <tbody>
                {data.activity_attempts.map((x: any, k: number) => (
                  <tr key={k} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-3"><Link href={`/teacher/activities/${x.activity_id}`} className="text-blue-600 hover:underline">{x.title}</Link>
                      <span className="ms-2 text-[10px] text-slate-400">{x.template === "live" ? "🔴" : t(`games.templates.${x.template}`)}</span></td>
                    <td className="p-3 text-center font-bold">{x.pct}% <span className="text-xs font-normal text-slate-400">({x.correct}/{x.total})</span></td>
                    <td className="p-3 text-center tabular-nums">{fmtTime(x.duration_sec)}</td>
                    <td className="p-3 text-center">{x.score}</td>
                    <td className="p-3 text-center text-slate-500">{new Date(x.at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

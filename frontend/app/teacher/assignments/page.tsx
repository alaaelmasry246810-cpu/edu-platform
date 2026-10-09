"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface AssignmentRow {
  id: string;
  kind: "exam" | "practice";
  title: string;
  target_count: number;
  submitted_count: number;
  available_from: string | null;
  due_at: string | null;
  created_at: string;
}

export default function TeacherAssignmentsPage() {
  const { t, dir } = useI18n();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentAPI.list().then(({ data }) => setAssignments(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.assignments.title")} 📝</h1>
          <p className="text-slate-500 text-sm mt-1">{t("teacher.assignments.subtitle")}</p>
        </div>
        <Link
          href="/teacher/assignments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          + {t("teacher.assignments.newAssignment")}
        </Link>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          {t("teacher.assignments.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/teacher/assignments/${a.id}`}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-all block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className={clsx(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  a.kind === "exam" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                )}>
                  {a.kind === "exam" ? t("teacher.assignments.kindExam") : t("teacher.assignments.kindPractice")}
                </span>
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-100 mb-2">{a.title}</div>
              <div className="text-sm text-slate-500">
                {t("teacher.assignments.completionCount", { done: a.submitted_count, total: a.target_count })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

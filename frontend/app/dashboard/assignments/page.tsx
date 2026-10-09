"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import { assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface AssignmentRow {
  id: string;
  kind: "exam" | "practice";
  title: string;
  available_from: string | null;
  due_at: string | null;
  attempt_count: number;
  last_attempt: { status: string; percentage: number | null } | null;
}

function statusOf(a: AssignmentRow): "not_open" | "closed" | "done" | "open" {
  const now = Date.now();
  if (a.available_from && new Date(a.available_from).getTime() > now) return "not_open";
  if (a.due_at && new Date(a.due_at).getTime() < now) return "closed";
  if (a.attempt_count > 0 && a.last_attempt?.status !== "in_progress") return "done";
  return "open";
}

export default function MyAssignmentsPage() {
  const { t, dir } = useI18n();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assignmentAPI.mine()
      .then(({ data }) => setAssignments(data))
      .catch(() => toast.error(t("dashboard.assignments.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    open:     { label: t("dashboard.assignments.status.open"),    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    not_open: { label: t("dashboard.assignments.status.notOpen"), color: "bg-slate-100 text-slate-600" },
    closed:   { label: t("dashboard.assignments.status.closed"),  color: "bg-red-100 text-red-700" },
    done:     { label: t("dashboard.assignments.status.done"),    color: "bg-blue-100 text-blue-700" },
  };

  return (
    <div dir={dir}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t("dashboard.assignments.title")} 📝</h1>
      <p className="text-slate-500 text-sm mb-6">{t("dashboard.assignments.subtitle")}</p>

      {assignments.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          {t("dashboard.assignments.empty")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => {
            const status = statusOf(a);
            const cfg = STATUS_CONFIG[status];
            const clickable = status === "open" || (status === "done" && a.kind === "practice");
            const card = (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 h-full">
                <div className="flex items-center justify-between mb-3">
                  <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", cfg.color)}>{cfg.label}</span>
                  <span className="text-xs text-slate-400">
                    {a.kind === "exam" ? t("teacher.assignments.kindExam") : t("teacher.assignments.kindPractice")}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">{a.title}</h3>
                {a.last_attempt?.percentage != null && (
                  <div className="text-sm text-slate-500">{t("dashboard.assignments.lastScore", { pct: a.last_attempt.percentage })}</div>
                )}
              </div>
            );
            return clickable ? (
              <Link key={a.id} href={`/dashboard/assignments/${a.id}`} className="hover:shadow-lg transition-all rounded-2xl block">
                {card}
              </Link>
            ) : (
              <div key={a.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

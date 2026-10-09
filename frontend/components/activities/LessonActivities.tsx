"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TEMPLATE_ICONS, type TemplateKey } from "./shared";

/** The lesson page's "Games" tab: activities made from this lesson. */
export default function LessonActivities({ curriculumId, lessonId, canManage }: { curriculumId: string; lessonId: string; canManage: boolean }) {
  const { t } = useI18n();
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { setList(null); activitiesAPI.list(lessonId).then(({ data }) => setList(data)).catch(() => setList([])); }, [lessonId]);
  const base = canManage ? "/teacher/activities" : "/dashboard/activities";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{canManage ? t("games.lesson.teacherHint") : t("games.lesson.studentHint")}</p>
        <div className="flex gap-2">
          {!canManage && <Link href="/play" className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold">🔴 {t("games.student.joinLive")}</Link>}
          {canManage && (
            <Link href={`/teacher/activities/new?curriculum=${curriculumId}&lesson=${lessonId}`} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">
              ✨ {t("games.lesson.create")}
            </Link>
          )}
        </div>
      </div>
      {list === null ? <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" /> : list.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <p className="text-4xl mb-2">🎲</p>
          <p className="text-slate-500 text-sm">{canManage ? t("games.lesson.emptyTeacher") : t("games.lesson.emptyStudent")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((a) => (
            <Link key={a.id} href={`${base}/${a.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 hover:shadow-md transition-shadow">
              <span className="text-3xl">{TEMPLATE_ICONS[a.template as TemplateKey] ?? "🎮"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                <p className="text-xs text-slate-500">{t("games.list.items", { n: a.item_count })}{a.best_score != null && ` · ✓ ${t("games.student.best", { n: a.best_score })}`}</p>
              </div>
              <span className="text-slate-400">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

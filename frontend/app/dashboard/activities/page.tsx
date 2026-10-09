"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TEMPLATE_ICONS, type TemplateKey } from "@/components/activities/shared";

/** The student's assigned activities (self-paced homework) + a shortcut to join a live game. */
export default function StudentActivities() {
  const { t, locale } = useI18n();
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { activitiesAPI.list().then(({ data }) => setList(data)).catch(() => setList([])); }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🎮 {t("games.student.title")}</h1>
          <p className="text-sm text-slate-500">{t("games.student.subtitle")}</p>
        </div>
        <Link href="/play" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold">🔴 {t("games.student.joinLive")}</Link>
      </div>
      {list === null ? (
        <div className="grid sm:grid-cols-2 gap-4">{[0, 1].map((k) => <div key={k} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <p className="text-5xl mb-2">🎲</p><p className="text-slate-500">{t("games.student.empty")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => {
            const overdue = a.due_at && new Date(a.due_at) < new Date();
            return (
              <Link key={a.id} href={`/dashboard/activities/${a.id}`} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{TEMPLATE_ICONS[a.template as TemplateKey] ?? "🎮"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{t("games.list.items", { n: a.item_count })}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 text-[11px] mt-auto">
                  {a.best_score != null
                    ? <span className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">✓ {t("games.student.best", { n: a.best_score })}</span>
                    : <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full">{t("games.student.new")}</span>}
                  {a.due_at && (
                    <span className={overdue ? "bg-red-100 text-red-600 px-2 py-0.5 rounded-full" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full"}>
                      ⏰ {new Date(a.due_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

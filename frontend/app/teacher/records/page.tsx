"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { fmtTime } from "@/components/activities/Leaderboard";

type Filter = "all" | "student" | "guest";

/** Everyone who played the teacher's activities — registered students and
 *  people who signed up through a share link — with their best results. */
export default function TeacherRecords() {
  const { t, locale } = useI18n();
  const [people, setPeople] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [created, setCreated] = useState<any>(null);
  const [busy, setBusy] = useState("");

  const load = () => activitiesAPI.records().then(({ data }) => setPeople(data.participants)).catch(() => setPeople([]));
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (people ?? []).filter((p) =>
    (filter === "all" || (filter === "student" ? p.kind !== "guest" : p.kind === "guest")) &&
    (!q.trim() || [p.name, p.phone, p.class].some((v) => v && String(v).includes(q.trim())))), [people, filter, q]);

  const convert = async (p: any) => {
    if (!confirm(t("games.records.convertConfirm", { name: p.name }))) return;
    setBusy(p.key);
    try {
      const { data } = await activitiesAPI.convertGuest({ phone: p.phone, full_name: p.name });
      setCreated(data);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("games.editor.error"));
    } finally { setBusy(""); }
  };
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }) : "—");
  const pctColor = (n: number) => (n >= 75 ? "text-green-600" : n >= 50 ? "text-amber-600" : "text-red-500");

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">📒 {t("games.records.title")}</h1>
        <p className="text-sm text-slate-500">{t("games.records.subtitle")}</p>
      </div>

      {created && (
        <div className="rounded-2xl border-2 border-green-400 bg-green-50 dark:bg-green-900/20 p-4 space-y-1">
          <p className="font-bold text-green-800 dark:text-green-200">✅ {t("games.records.created", { name: created.full_name, n: created.moved_results })}</p>
          <p className="text-sm text-green-900 dark:text-green-100">
            {t("games.records.loginWith")} <b dir="ltr">{created.phone}</b> · {t("games.records.tempPassword")} <b dir="ltr" className="font-mono">{created.temporary_password}</b>
          </p>
          <p className="text-xs text-green-800/80 dark:text-green-200/80">{t("games.records.passwordOnce")}</p>
          <button onClick={() => { navigator.clipboard?.writeText(`${created.phone} / ${created.temporary_password}`); toast.success(t("games.share.copied")); }}
            className="text-xs underline text-green-800 dark:text-green-200">📋 {t("games.records.copyLogin")}</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "student", "guest"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={clsx("px-3 py-1.5 rounded-full text-sm border",
            filter === f ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300")}>
            {t(`games.records.filters.${f}`)}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("games.records.search")}
          className="ms-auto border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm w-60" />
      </div>

      {people === null ? <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" /> : shown.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <p className="text-4xl mb-2">📒</p><p className="text-slate-500">{t("games.records.empty")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs">
              <tr>
                <th className="p-3 text-start">{t("games.records.name")}</th>
                <th className="p-3 text-start hidden sm:table-cell">{t("games.records.phone")}</th>
                <th className="p-3 text-start hidden md:table-cell">{t("games.records.class")}</th>
                <th className="p-3">{t("games.records.activities")}</th>
                <th className="p-3">{t("games.records.avg")}</th>
                <th className="p-3 hidden sm:table-cell">{t("games.records.last")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <Fragment key={p.key}>
                  <tr className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => setOpen(open === p.key ? null : p.key)}>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span>
                      <span className={clsx("ms-2 text-[10px] px-1.5 py-0.5 rounded-full", p.kind === "guest" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300")}>
                        {p.kind === "guest" ? t("games.records.guest") : t("games.records.student")}
                      </span>
                    </td>
                    <td className="p-3 hidden sm:table-cell font-mono text-xs" dir="ltr">{p.phone ?? "—"}</td>
                    <td className="p-3 hidden md:table-cell">{p.class ?? "—"}</td>
                    <td className="p-3 text-center">{p.activity_count}</td>
                    <td className={clsx("p-3 text-center font-bold", pctColor(p.avg_pct))}>{p.avg_pct}%</td>
                    <td className="p-3 text-center hidden sm:table-cell text-slate-500">{date(p.last_at)}</td>
                    <td className="p-3 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {p.kind === "guest" && p.phone ? (
                        <button onClick={() => convert(p)} disabled={busy === p.key} className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-50">➕ {t("games.records.convert")}</button>
                      ) : p.student_id ? (
                        <Link href={`/teacher/students/${p.student_id}`} className="text-xs text-blue-600 hover:underline">{t("games.records.openRecord")}</Link>
                      ) : null}
                    </td>
                  </tr>
                  {open === p.key && (
                    <tr className="bg-slate-50 dark:bg-slate-900/40">
                      <td colSpan={7} className="p-3">
                        <div className="grid sm:grid-cols-2 gap-2">
                          {p.activities.map((x: any) => (
                            <Link key={x.activity_id} href={`/teacher/activities/${x.activity_id}`} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 hover:shadow">
                              <span className="flex-1 truncate">{x.title}</span>
                              <span className={clsx("font-bold", pctColor(x.best_pct))}>{x.best_pct}%</span>
                              <span className="text-xs text-slate-500">⏱ {x.best_time != null ? fmtTime(x.best_time) : "—"}</span>
                              <span className="text-xs text-slate-400">×{x.attempts}</span>
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

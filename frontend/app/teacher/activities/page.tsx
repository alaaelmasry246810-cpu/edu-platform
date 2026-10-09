"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { TEMPLATE_ICONS, type TemplateKey } from "@/components/activities/shared";

export default function TeacherActivities() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"mine" | "library">("mine");
  const [mine, setMine] = useState<any[] | null>(null);
  const [library, setLibrary] = useState<any[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { activitiesAPI.list().then(({ data }) => setMine(data)).catch(() => setMine([])); }, []);
  useEffect(() => {
    if (tab !== "library") return;
    const id = setTimeout(() => activitiesAPI.library(q).then(({ data }) => setLibrary(data)).catch(() => setLibrary([])), 300);
    return () => clearTimeout(id);
  }, [tab, q]);

  const copy = async (id: string) => {
    try {
      const { data } = await activitiesAPI.duplicate(id);
      toast.success(t("games.list.copied"));
      router.push(`/teacher/activities/${data.id}`);
    } catch { toast.error(t("games.editor.error")); }
  };

  const list = tab === "mine" ? mine : library;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">🎮 {t("games.list.title")}</h1>
          <p className="text-sm text-slate-500">{t("games.list.subtitle")}</p>
        </div>
        <Link href="/teacher/activities/new" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold">+ {t("games.list.create")}</Link>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {(["mine", "library"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("px-4 py-2 text-sm font-semibold border-b-2 -mb-px", tab === k ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500")}>
            {k === "mine" ? `📁 ${t("games.list.mine")}` : `🌍 ${t("games.list.library")}`}
          </button>
        ))}
        {tab === "library" && (
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("games.list.search")}
            className="ms-auto mb-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm w-56" />
        )}
      </div>

      {list === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((k) => <div key={k} className="h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <p className="text-5xl mb-2">🎲</p>
          <p className="text-slate-500">{tab === "mine" ? t("games.list.emptyMine") : t("games.list.emptyLibrary")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{TEMPLATE_ICONS[a.template as TemplateKey] ?? "🎮"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                  <p className="text-xs text-slate-500">{t("games.list.items", { n: a.item_count })} · {t("games.list.plays", { n: a.plays })}</p>
                  {tab === "library" && a.owner_name && <p className="text-xs text-slate-400">👤 {a.owner_name}{a.subject ? ` · ${a.subject}` : ""}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 text-[11px]">
                {a.assigned && <span className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">📝 {t("games.list.assigned")}</span>}
                {a.is_public && tab === "mine" && <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full">🌍 {t("games.list.public")}</span>}
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <Link href={`/teacher/activities/${a.id}`} className="flex-1 text-center rounded-lg bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-1.5 text-sm font-semibold">
                  {tab === "mine" ? t("games.list.open") : t("games.list.preview")}
                </Link>
                {tab === "library" && !a.is_owner && (
                  <button onClick={() => copy(a.id)} className="flex-1 rounded-lg border-2 border-blue-500 text-blue-600 py-1.5 text-sm font-semibold">📥 {t("games.list.copy")}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI, liveAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import ActivityPlayer from "@/components/activities/ActivityPlayer";
import { ActivityEditor, AssignPanel, ReportPanel } from "@/components/activities/TeacherPanels";

type Tab = "play" | "edit" | "assign" | "report";

export default function TeacherActivity() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [activity, setActivity] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("play");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    activitiesAPI.get(id).then(({ data }) => setActivity(data)).catch(() => toast.error(t("games.loadError")));
  }, [id]);

  const startLive = async () => {
    setStarting(true);
    try {
      const { data } = await liveAPI.create(id, activity.time_per_question);
      router.push(`/teacher/live/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("games.editor.error"));
      setStarting(false);
    }
  };
  const copy = async () => {
    const { data } = await activitiesAPI.duplicate(id);
    toast.success(t("games.list.copied"));
    router.push(`/teacher/activities/${data.id}`);
  };
  const remove = async () => {
    if (!confirm(t("games.deleteConfirm"))) return;
    await activitiesAPI.delete(id);
    router.push("/teacher/activities");
  };

  if (!activity) return <div className="max-w-5xl mx-auto h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;

  const owner = activity.is_owner;
  const tabs: { key: Tab; label: string }[] = owner
    ? [{ key: "play", label: `▶ ${t("games.tabs.play")}` }, { key: "edit", label: `✏️ ${t("games.tabs.edit")}` },
       { key: "assign", label: `📝 ${t("games.tabs.assign")}` }, { key: "report", label: `📊 ${t("games.tabs.report")}` }]
    : [{ key: "play", label: `▶ ${t("games.tabs.play")}` }];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{activity.title}</h1>
          <p className="text-sm text-slate-500">
            {t("games.list.items", { n: activity.item_count })}
            {!owner && activity.owner_name && ` · 👤 ${activity.owner_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={startLive} disabled={starting} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-60">
            🔴 {t("games.live.start")}
          </button>
          {!owner && <button onClick={copy} className="px-4 py-2 rounded-xl border-2 border-blue-500 text-blue-600 text-sm font-bold">📥 {t("games.list.copy")}</button>}
          {owner && <button onClick={remove} className="px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm">🗑</button>}
        </div>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {tabs.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)}
              className={clsx("px-4 py-2 text-sm font-semibold border-b-2 -mb-px", tab === x.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500")}>
              {x.label}
            </button>
          ))}
        </div>
      )}

      {tab === "play" && <ActivityPlayer activity={activity} classroom />}
      {tab === "edit" && <ActivityEditor activity={activity} onSaved={(a) => { setActivity(a); setTab("play"); }} />}
      {tab === "assign" && <AssignPanel activity={activity} onSaved={setActivity} />}
      {tab === "report" && <ReportPanel activityId={activity.id} />}
    </div>
  );
}

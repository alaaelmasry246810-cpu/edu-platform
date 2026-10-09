"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import ActivityPlayer from "@/components/activities/ActivityPlayer";

export default function StudentActivity() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [activity, setActivity] = useState<any>(null);
  const [error, setError] = useState(false);
  useEffect(() => { activitiesAPI.get(id).then(({ data }) => setActivity(data)).catch(() => setError(true)); }, [id]);

  if (error) return <p className="text-center text-slate-500 py-16">{t("games.loadError")}</p>;
  if (!activity) return <div className="max-w-4xl mx-auto h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link href="/dashboard/activities" className="text-sm text-slate-500 hover:underline">← {t("games.student.title")}</Link>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{activity.title}</h1>
      {activity.description && <p className="text-slate-500">{activity.description}</p>}
      <ActivityPlayer activity={activity} saveAttempts />
    </div>
  );
}

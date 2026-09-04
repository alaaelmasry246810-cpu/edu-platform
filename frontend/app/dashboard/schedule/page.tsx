"use client";
import { useEffect, useState } from "react";
import { scheduleAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import ScheduleGrid, { ScheduleEntry } from "@/components/schedule/ScheduleGrid";

type Tab = "school" | "study";

export default function StudentSchedulePage() {
  const { t, dir } = useI18n();
  const [tab, setTab] = useState<Tab>("school");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolEntries, setSchoolEntries] = useState<ScheduleEntry[]>([]);
  const [studyEntries, setStudyEntries] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    scheduleAPI.get("me")
      .then(({ data }) => {
        setSchoolEntries(data.school_schedule || []);
        setStudyEntries(data.study_schedule || []);
      })
      .catch(() => toast.error(t("dashboard.schedule.loadError")))
      .finally(() => setLoading(false));
  }, []);

  const entries = tab === "school" ? schoolEntries : studyEntries;
  const setEntries = tab === "school" ? setSchoolEntries : setStudyEntries;

  const handleAdd = (day: string) => {
    const newEntry: ScheduleEntry = { day, start_time: "08:00", end_time: "08:45", title: "" };
    if (tab === "study") newEntry.source = "student";
    setEntries(prev => [...prev, newEntry]);
  };

  const handleEdit = (index: number, field: "start_time" | "end_time" | "title", value: string) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== index) return e;
      if (tab === "study" && e.source === "teacher") return e; // locked
      return { ...e, [field]: value };
    }));
  };

  const handleRemove = async (index: number) => {
    const entry = entries[index];
    if (tab === "study" && entry.source === "teacher") {
      toast.error(t("dashboard.schedule.cannotDeleteTeacherEntry"));
      return;
    }
    if (!confirm(t("dashboard.schedule.deleteConfirm"))) return;

    if (tab === "study") {
      try {
        await scheduleAPI.removeStudyEntry("me", entry.day, entry.start_time);
      } catch {
        // not yet saved on the server — fine, just drop it locally
      }
    }
    setEntries(prev => prev.filter((_, i) => i !== index));
    toast.success(t("dashboard.schedule.deleteSuccess"));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "school") {
        const { data } = await scheduleAPI.saveSchool("me", schoolEntries);
        setSchoolEntries(data.school_schedule || []);
      } else {
        const { data } = await scheduleAPI.saveStudy("me", studyEntries.filter(e => e.source !== "teacher"));
        setStudyEntries(data.study_schedule || []);
        if (data.skipped?.length) {
          toast(t("dashboard.schedule.skippedNotice", { n: data.skipped.length }));
        }
      }
      toast.success(t("dashboard.schedule.saveSuccess"));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("dashboard.schedule.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("dashboard.schedule.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("dashboard.schedule.subtitle")}</p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-5">
        {([
          { key: "school", label: t("dashboard.schedule.tabs.school") },
          { key: "study", label: t("dashboard.schedule.tabs.study") },
        ] as { key: Tab; label: string }[]).map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={clsx(
              "px-5 py-2.5 text-sm font-semibold transition-colors",
              tab === tb.key ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 mb-4">
        {tab === "school" ? t("dashboard.schedule.school.hint") : t("dashboard.schedule.study.hint")}
      </p>

      <ScheduleGrid
        entries={entries}
        titlePlaceholder={tab === "school" ? t("dashboard.schedule.school.subjectPlaceholder") : t("dashboard.schedule.study.titlePlaceholder")}
        addRowLabel={tab === "school" ? t("dashboard.schedule.school.addRow") : t("dashboard.schedule.study.addRow")}
        isLocked={tab === "study" ? (e) => e.source === "teacher" : undefined}
        lockedLabel={t("dashboard.schedule.study.lockedByTeacher")}
        ownLabel={t("dashboard.schedule.study.yourEntry")}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onRemove={handleRemove}
      />

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-medium"
      >
        {saving ? t("dashboard.schedule.saving") : t("dashboard.schedule.save")}
      </button>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { scheduleAPI, teacherAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import ScheduleGrid, { ScheduleEntry } from "@/components/schedule/ScheduleGrid";

type Tab = "school" | "study";

export default function TeacherStudentSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useI18n();
  const [tab, setTab] = useState<Tab>("school");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolEntries, setSchoolEntries] = useState<ScheduleEntry[]>([]);
  const [studyEntries, setStudyEntries] = useState<ScheduleEntry[]>([]);

  useEffect(() => {
    Promise.all([scheduleAPI.get(id), teacherAPI.studentAttempts(id)])
      .then(([sched, detail]) => {
        setSchoolEntries(sched.data.school_schedule || []);
        setStudyEntries(sched.data.study_schedule || []);
        setStudentName(detail.data.student?.full_name || "");
      })
      .catch(() => toast.error(t("teacher.studentSchedule.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  const entries = tab === "school" ? schoolEntries : studyEntries;
  const setEntries = tab === "school" ? setSchoolEntries : setStudyEntries;

  const handleAdd = (day: string) => {
    const newEntry: ScheduleEntry = { day, start_time: "08:00", end_time: "08:45", title: "" };
    if (tab === "study") newEntry.source = "teacher";
    setEntries(prev => [...prev, newEntry]);
  };

  const handleEdit = (index: number, field: "start_time" | "end_time" | "title", value: string) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleRemove = async (index: number) => {
    const entry = entries[index];
    if (!confirm(t("teacher.studentSchedule.deleteConfirm"))) return;

    if (tab === "study") {
      try {
        await scheduleAPI.removeStudyEntry(id, entry.day, entry.start_time);
      } catch {
        // not yet saved server-side — fine
      }
    }
    setEntries(prev => prev.filter((_, i) => i !== index));
    toast.success(t("teacher.studentSchedule.deleteSuccess"));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "school") {
        const { data } = await scheduleAPI.saveSchool(id, schoolEntries);
        setSchoolEntries(data.school_schedule || []);
      } else {
        const { data } = await scheduleAPI.saveStudy(id, studyEntries);
        setStudyEntries(data.study_schedule || []);
      }
      toast.success(t("teacher.studentSchedule.saveSuccess"));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacher.studentSchedule.saveError"));
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
        <Link href={`/teacher/students/${id}`} className="text-sm text-blue-600 hover:underline">{t("teacher.studentSchedule.backToStudent")}</Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{t("teacher.studentSchedule.title", { name: studentName })}</h1>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t("teacher.studentSchedule.hint")}</p>
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

      <ScheduleGrid
        entries={entries}
        titlePlaceholder={tab === "school" ? t("dashboard.schedule.school.subjectPlaceholder") : t("dashboard.schedule.study.titlePlaceholder")}
        addRowLabel={tab === "school" ? t("dashboard.schedule.school.addRow") : t("dashboard.schedule.study.addRow")}
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

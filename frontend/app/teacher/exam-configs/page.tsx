"use client";
import { useEffect, useState } from "react";
import { teacherAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

type ExamType = "lesson_practice" | "unit_practice" | "comprehensive";

const DEFAULT_CONFIG = (type: ExamType) => ({
  exam_type: type,
  time_limit_minutes: 30,
  mcq_count: 10, true_false_count: 5, fill_blank_count: 3, why_count: 2, essay_count: 0,
  mcq_points: 2.0, true_false_points: 1.0, fill_blank_points: 2.0, why_points: 5.0, essay_points: 10.0,
  pass_threshold: 60.0, difficulty: "medium",
});

export default function ExamConfigsPage() {
  const { user } = useAuthStore();
  const { t, dir } = useI18n();
  const isAdmin = user?.role === "admin";
  const [configs, setConfigs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const EXAM_LABELS: Record<ExamType, string> = {
    lesson_practice: t("teacher.examConfigs.labels.lesson_practice"),
    unit_practice:   t("teacher.examConfigs.labels.unit_practice"),
    comprehensive:   t("teacher.examConfigs.labels.comprehensive"),
  };

  useEffect(() => {
    teacherAPI.examConfigs()
      .then(({ data }) => setConfigs(data))
      .catch(() => toast.error(t("teacher.examConfigs.loadError")))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (type: ExamType) => {
    const existing = configs.find(c => c.exam_type === type && !c.curriculum_id);
    setEditing(existing ? { ...existing } : DEFAULT_CONFIG(type));
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await teacherAPI.upsertExamConfig(editing);
      toast.success(t("teacher.examConfigs.save"));
      const { data } = await teacherAPI.examConfigs();
      setConfigs(data);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.examConfigs.loadError"));
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: string, type: "number" | "text" = "number", step = 1) => (
    <div key={key}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        step={step}
        value={editing?.[key] ?? ""}
        onChange={e => setEditing((prev: any) => ({ ...prev, [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700"
        disabled={!isAdmin}
      />
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.examConfigs.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isAdmin ? t("teacher.examConfigs.subtitleAdmin") : t("teacher.examConfigs.subtitleReadOnly")}
        </p>
      </div>

      {/* Config cards per type */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {(["lesson_practice", "unit_practice", "comprehensive"] as ExamType[]).map(type => {
          const cfg = configs.find(c => c.exam_type === type && !c.curriculum_id);
          return (
            <div key={type} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{EXAM_LABELS[type]}</h2>
              {cfg ? (
                <dl className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.time")}</dt><dd className="font-medium text-slate-700 dark:text-slate-300">{cfg.time_limit_minutes} {t("teacher.examConfigs.minutes")}</dd></div>
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.mcq")}</dt><dd>{cfg.mcq_count} × {cfg.mcq_points} {t("teacher.examConfigs.pointsUnit")}</dd></div>
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.trueFalse")}</dt><dd>{cfg.true_false_count} × {cfg.true_false_points} {t("teacher.examConfigs.pointsUnit")}</dd></div>
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.fillBlank")}</dt><dd>{cfg.fill_blank_count} × {cfg.fill_blank_points} {t("teacher.examConfigs.pointsUnit")}</dd></div>
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.why")}</dt><dd>{cfg.why_count} × {cfg.why_points} {t("teacher.examConfigs.pointsUnit")}</dd></div>
                  <div className="flex justify-between"><dt>{t("teacher.examConfigs.essay")}</dt><dd>{cfg.essay_count} × {cfg.essay_points} {t("teacher.examConfigs.pointsUnit")}</dd></div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700"><dt>{t("teacher.examConfigs.passFrom")}</dt><dd className="font-bold text-blue-700 dark:text-blue-400">{cfg.pass_threshold}%</dd></div>
                </dl>
              ) : (
                <p className="text-xs text-slate-400 mb-3">{t("teacher.examConfigs.defaultNote")}</p>
              )}
              {isAdmin && (
                <button
                  onClick={() => handleEdit(type)}
                  className="mt-3 w-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 py-2 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-medium"
                >
                  {t("teacher.examConfigs.editBtn")}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit form */}
      {editing && isAdmin && (
        <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-2xl p-6">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 mb-5">
            {t("teacher.examConfigs.editingTitle", { type: EXAM_LABELS[editing.exam_type as ExamType] })}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-4">
            {field(t("teacher.examConfigs.timeMinutesLabel"), "time_limit_minutes")}
            {field(t("teacher.examConfigs.passPercentLabel"), "pass_threshold", "number", 1)}
          </div>

          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">{t("teacher.examConfigs.questionCountsTitle")}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
            {field(t("teacher.examConfigs.mcq"), "mcq_count")}
            {field(t("teacher.examConfigs.trueFalseLabel"), "true_false_count")}
            {field(t("teacher.examConfigs.fillBlankLabel"), "fill_blank_count")}
            {field(t("teacher.examConfigs.why"), "why_count")}
            {field(t("teacher.examConfigs.essay"), "essay_count")}
          </div>

          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">{t("teacher.examConfigs.questionPointsTitle")}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-5">
            {field(t("teacher.examConfigs.mcqPointsLabel"), "mcq_points", "number", 0.5)}
            {field(t("teacher.examConfigs.trueFalsePointsLabel"), "true_false_points", "number", 0.5)}
            {field(t("teacher.examConfigs.fillBlankPointsLabel"), "fill_blank_points", "number", 0.5)}
            {field(t("teacher.examConfigs.whyPointsLabel"), "why_points", "number", 0.5)}
            {field(t("teacher.examConfigs.essayPointsLabel"), "essay_points", "number", 0.5)}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {saving ? t("teacher.examConfigs.saving") : t("teacher.examConfigs.save")}
            </button>
            <button onClick={() => setEditing(null)} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700">
              {t("teacher.examConfigs.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

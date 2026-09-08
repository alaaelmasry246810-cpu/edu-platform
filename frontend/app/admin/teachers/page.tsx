"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  status: string;
  suspension_reason?: string | null;
  teacher_code: string;
  features: Record<string, boolean>;
  student_count: number;
  created_at: string;
}

export default function AdminTeachersPage() {
  const { t, dir } = useI18n();

  const FEATURE_FLAGS = [
    { key: "can_grant_ai_assist",      label: t("admin.teachers.features.aiAssist.label"),      icon: "🤖", desc: t("admin.teachers.features.aiAssist.desc") },
    { key: "can_export_pdf",           label: t("admin.teachers.features.exportPdf.label"),     icon: "📄", desc: t("admin.teachers.features.exportPdf.desc") },
    { key: "can_access_question_bank", label: t("admin.teachers.features.questionBank.label"),  icon: "🗂️", desc: t("admin.teachers.features.questionBank.desc") },
    { key: "can_view_analytics",       label: t("admin.teachers.features.analytics.label"),     icon: "📊", desc: t("admin.teachers.features.analytics.desc") },
    { key: "can_add_channel_links",    label: t("admin.teachers.features.channelLinks.label"),  icon: "🔗", desc: t("admin.teachers.features.channelLinks.desc") },
  ];

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [formFeatures, setFormFeatures] = useState<Record<string, boolean>>(
    Object.fromEntries(FEATURE_FLAGS.map(f => [f.key, false]))
  );
  const [saving, setSaving] = useState(false);
  const [updatingFeatures, setUpdatingFeatures] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/admin/teachers")
      .then(r => setTeachers(r.data))
      .catch(() => toast.error(t("admin.teachers.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/teachers", { ...form, features: formFeatures });
      toast.success(t("admin.teachers.createSuccess"));
      setShowForm(false);
      setForm({ full_name: "", email: "", phone: "", password: "" });
      setFormFeatures(Object.fromEntries(FEATURE_FLAGS.map(f => [f.key, false])));
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("admin.teachers.createError"));
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = async (teacherId: string, flag: string, current: boolean) => {
    setUpdatingFeatures(`${teacherId}-${flag}`);
    try {
      const { data } = await api.patch(`/admin/teachers/${teacherId}/features`, {
        features: { [flag]: !current }
      });
      setTeachers(prev => prev.map(t => t.id === teacherId ? { ...t, features: data.features } : t));
      if (selectedTeacher?.id === teacherId) {
        setSelectedTeacher(prev => prev ? { ...prev, features: data.features } : null);
      }
      toast.success(!current
        ? t("admin.teachers.toggleFeatureOn", { feature: FEATURE_FLAGS.find(f => f.key === flag)?.label ?? "" })
        : t("admin.teachers.toggleFeatureOff"));
    } catch {
      toast.error(t("admin.teachers.updateError"));
    } finally {
      setUpdatingFeatures(null);
    }
  };

  const toggleStatus = async (teacher: Teacher) => {
    const newStatus = teacher.status === "active" ? "suspended" : "active";
    try {
      await api.patch(`/admin/teachers/${teacher.id}/status`, { status: newStatus });
      setTeachers(prev => prev.map(t => t.id === teacher.id ? { ...t, status: newStatus } : t));
      toast.success(newStatus === "active" ? t("admin.teachers.activateSuccess") : t("admin.teachers.suspendSuccess"));
    } catch {
      toast.error(t("admin.teachers.updateError"));
    }
  };

  const deleteTeacher = async (teacher: Teacher) => {
    if (!confirm(t("admin.teachers.deleteConfirm", { name: teacher.full_name }))) return;
    try {
      await api.delete(`/admin/teachers/${teacher.id}`);
      toast.success(t("admin.teachers.deleteSuccess"));
      setSelectedTeacher(null);
      load();
    } catch {
      toast.error(t("admin.teachers.deleteError"));
    }
  };

  const filtered = teachers.filter(t =>
    !search || t.full_name.toLowerCase().includes(search.toLowerCase()) || t.email.includes(search)
  );

  return (
    <div dir={dir} className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("admin.teachers.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("admin.teachers.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder={t("admin.teachers.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? t("admin.teachers.cancel") : t("admin.teachers.addTeacher")}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
          <h2 className="font-bold text-slate-800 dark:text-white mb-5">{t("admin.teachers.createFormTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("admin.teachers.fullName")}</label>
              <input
                required
                type="text"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("admin.teachers.email")}</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("admin.teachers.phone")}</label>
              <input
                required
                type="tel"
                dir="ltr"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("admin.teachers.password")}</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* Features for new teacher */}
          <div className="mb-5">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">{t("admin.teachers.grantedFeatures")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FEATURE_FLAGS.map(f => (
                <label key={f.key} className="flex items-start gap-2 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                  <input
                    type="checkbox"
                    checked={formFeatures[f.key]}
                    onChange={e => setFormFeatures(prev => ({ ...prev, [f.key]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.icon} {f.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{f.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2">{t("admin.teachers.cancel")}</button>
            <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
              {saving ? t("admin.teachers.creating") : t("admin.teachers.createTeacher")}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teachers list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-4xl mb-3">👨‍🏫</p>
              <p className="text-slate-500">{t("admin.teachers.noTeachers")}{search ? t("admin.teachers.noTeachersFiltered") : t("admin.teachers.noTeachersYet")}</p>
              <button onClick={() => setShowForm(true)} className="mt-4 text-blue-600 hover:underline text-sm">{t("admin.teachers.addFirstTeacher")}</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(t_ => (
                <div
                  key={t_.id}
                  onClick={() => setSelectedTeacher(t_)}
                  className={clsx(
                    "bg-white dark:bg-slate-800 rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md",
                    selectedTeacher?.id === t_.id
                      ? "border-blue-400 dark:border-blue-600 shadow-md"
                      : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-white">{t_.full_name}</span>
                        <span className={clsx("text-xs px-2 py-0.5 rounded-full", t_.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                          {t_.status === "active" ? t("admin.teachers.active") : t("admin.teachers.suspended")}
                        </span>
                        {t_.suspension_reason === "devtools_detected" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={t("admin.teachers.autoSuspendHint")}>
                            🤖 {t("admin.teachers.autoSuspended")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{t_.email}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>👥 {t_.student_count} {t("admin.teachers.studentsCount")}</span>
                        <span>🔑 {t_.teacher_code}</span>
                      </div>
                      {/* Feature chips */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {FEATURE_FLAGS.filter(f => t_.features[f.key]).map(f => (
                          <span key={f.key} className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                            {f.icon} {f.label}
                          </span>
                        ))}
                        {FEATURE_FLAGS.filter(f => t_.features[f.key]).length === 0 && (
                          <span className="text-[10px] text-slate-400">{t("admin.teachers.noFeaturesEnabled")}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 text-sm">{dir === "rtl" ? "←" : "→"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Teacher detail panel */}
        <div>
          {!selectedTeacher ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 h-full flex flex-col items-center justify-center min-h-[300px]">
              <p className="text-3xl mb-2">👆</p>
              <p className="text-sm">{t("admin.teachers.selectTeacherPrompt")}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 p-5 shadow-sm sticky top-6">
              <div className="mb-5">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg">{selectedTeacher.full_name}</h3>
                <p className="text-xs text-slate-400">{selectedTeacher.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={clsx("text-xs px-2 py-0.5 rounded-full", selectedTeacher.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>
                    {selectedTeacher.status === "active" ? `✓ ${t("admin.teachers.active")}` : `✗ ${t("admin.teachers.suspended")}`}
                  </span>
                  {selectedTeacher.suspension_reason === "devtools_detected" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={t("admin.teachers.autoSuspendHint")}>
                      🤖 {t("admin.teachers.autoSuspended")}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{t("admin.teachers.code")}: {selectedTeacher.teacher_code}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedTeacher.student_count} {t("admin.teachers.studentsRegistered")}
                </p>
              </div>

              {/* Feature toggles */}
              <div className="space-y-2 mb-5">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">{t("admin.teachers.teacherPermissions")}</p>
                {FEATURE_FLAGS.map(f => {
                  const isOn = selectedTeacher.features[f.key];
                  const key = `${selectedTeacher.id}-${f.key}`;
                  const isUpdating = updatingFeatures === key;

                  return (
                    <div key={f.key} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.icon} {f.label}</div>
                        <div className="text-xs text-slate-400">{f.desc}</div>
                      </div>
                      <button
                        onClick={() => toggleFeature(selectedTeacher.id, f.key, isOn)}
                        disabled={isUpdating}
                        className={clsx(
                          "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                          isOn ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-600",
                          isUpdating && "opacity-60 cursor-wait"
                        )}
                      >
                        <span className={clsx(
                          "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                          isOn ? "translate-x-[-1.25rem]" : "translate-x-[-0.25rem]"
                        )} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toggleStatus(selectedTeacher)}
                  className={clsx(
                    "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedTeacher.status === "active"
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  )}
                >
                  {selectedTeacher.status === "active" ? t("admin.teachers.suspendAccount") : t("admin.teachers.activateAccount")}
                </button>
                <button
                  onClick={() => deleteTeacher(selectedTeacher)}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  {t("admin.teachers.deleteTeacher")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

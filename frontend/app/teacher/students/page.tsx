"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherAPI, api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

const STATUS_COLOR: Record<string, string> = {
  active:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function StudentsPage() {
  const { user } = useAuthStore();
  const { t, dir, locale } = useI18n();
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({ full_name: "", email: "" });
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ full_name: string; email: string; temporary_password: string } | null>(null);

  const STATUS_LABEL: Record<string, string> = {
    active: t("teacher.students.status.active"),
    pending: t("teacher.students.status.pending"),
    suspended: t("teacher.students.status.suspended"),
  };

  // Does this teacher have permission to grant AI assist?
  const canGrantAI = user?.role === "admin" ||
    (user as any)?.teacher_features?.can_grant_ai_assist === true;

  useEffect(() => { load(); }, []);

  const load = () => {
    setLoading(true);
    teacherAPI.students()
      .then(({ data }) => setStudents(data))
      .catch(() => toast.error(t("teacher.students.loadError")))
      .finally(() => setLoading(false));
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await teacherAPI.createStudent(newStudent);
      setCredentials({ full_name: data.full_name, email: data.email, temporary_password: data.temporary_password });
      setShowAddForm(false);
      setNewStudent({ full_name: "", email: "" });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacher.students.addStudent.error"));
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (student: any) => {
    if (!confirm(t("teacher.students.resetPassword.confirm", { name: student.full_name }))) return;
    setResettingId(student.id);
    try {
      const { data } = await teacherAPI.resetStudentPassword(student.id);
      setCredentials({ full_name: student.full_name, email: student.email, temporary_password: data.temporary_password });
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacher.students.resetPassword.error"));
    } finally {
      setResettingId(null);
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `${credentials.email}\n${credentials.temporary_password}`
    );
    toast.success(t("teacher.students.addStudent.copied"));
  };

  const toggleAI = async (studentId: string) => {
    setToggling(studentId);
    try {
      const { data } = await api.patch(`/teacher/students/${studentId}/ai-assist`);
      setStudents(prev =>
        prev.map(s => s.id === studentId ? { ...s, ai_assist_enabled: data.ai_assist_enabled } : s)
      );
      toast.success(data.ai_assist_enabled ? t("teacher.students.aiToggleSuccessOn") : t("teacher.students.aiToggleSuccessOff"));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacher.students.aiToggleError"));
    } finally {
      setToggling(null);
    }
  };

  const filtered = students.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.includes(search)
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.students.title")}</h1>
          <p className="text-slate-500 text-sm">{t("teacher.students.subtitle")}</p>
          {canGrantAI && (
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {t("teacher.students.aiPermissionNote")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={t("teacher.students.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700"
          />
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
          >
            {showAddForm ? t("common.cancel") : t("teacher.students.addStudent.button")}
          </button>
        </div>
      </div>

      {/* Add student form */}
      {showAddForm && (
        <form onSubmit={handleCreateStudent} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">{t("teacher.students.addStudent.formTitle")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("teacher.students.addStudent.fullName")}</label>
              <input
                required type="text" value={newStudent.full_name}
                onChange={e => setNewStudent({ ...newStudent, full_name: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t("teacher.students.addStudent.email")}</label>
              <input
                required type="email" value={newStudent.email}
                onChange={e => setNewStudent({ ...newStudent, email: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">{t("teacher.students.addStudent.hint")}</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAddForm(false)} className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2">{t("common.cancel")}</button>
            <button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
              {creating ? t("teacher.students.addStudent.creating") : t("teacher.students.addStudent.submit")}
            </button>
          </div>
        </form>
      )}

      {/* One-time credentials modal */}
      {credentials && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCredentials(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            <p className="text-2xl mb-2">✅</p>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">
              {t("teacher.students.addStudent.created", { name: credentials.full_name })}
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">{t("teacher.students.addStudent.oneTimeWarning")}</p>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-2 mb-4">
              <div className="text-sm"><span className="text-slate-400">{t("teacher.students.addStudent.email")}: </span><span className="font-mono text-slate-800 dark:text-slate-200">{credentials.email}</span></div>
              <div className="text-sm"><span className="text-slate-400">{t("teacher.students.addStudent.tempPassword")}: </span><span className="font-mono font-bold text-slate-800 dark:text-slate-200">{credentials.temporary_password}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={copyCredentials} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">
                {t("teacher.students.addStudent.copyButton")}
              </button>
              <button onClick={() => setCredentials(null)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-sm font-medium">
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legend for AI assist */}
      {canGrantAI && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-purple-700 dark:text-purple-300">
            <p className="font-medium">{t("teacher.students.aiAssistTitle")}</p>
            <p className="text-purple-500 text-xs mt-0.5">
              {t("teacher.students.aiAssistDesc")}
            </p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-4xl mb-3">👥</div>
          <p>{t("teacher.students.emptyPrefix")} {search ? t("teacher.students.emptyNoMatch") : t("teacher.students.emptyNoStudents")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900">
                  <th className="text-right px-4 py-3">{t("teacher.students.table.name")}</th>
                  <th className="text-right px-4 py-3">{t("teacher.students.table.email")}</th>
                  <th className="text-right px-4 py-3">{t("teacher.students.table.status")}</th>
                  <th className="text-right px-4 py-3">{t("teacher.students.table.plan")}</th>
                  {canGrantAI && <th className="text-right px-4 py-3">{t("teacher.students.table.aiAssist")}</th>}
                  <th className="text-right px-4 py-3">{t("teacher.students.table.joinDate")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.email}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLOR[s.status] ?? "bg-slate-100 text-slate-600")}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {s.plan === "free" ? t("common.plans.free") : s.plan === "monthly" ? t("common.plans.monthly") : t("common.plans.yearly")}
                    </td>

                    {/* AI Assist toggle */}
                    {canGrantAI && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleAI(s.id)}
                          disabled={toggling === s.id}
                          className={clsx(
                            "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            s.ai_assist_enabled
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600",
                            toggling === s.id && "opacity-60 cursor-wait"
                          )}
                          title={s.ai_assist_enabled ? t("teacher.students.aiDisableTitle") : t("teacher.students.aiEnableTitle")}
                        >
                          {toggling === s.id ? (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span>{s.ai_assist_enabled ? "🟣" : "⚫"}</span>
                          )}
                          {s.ai_assist_enabled ? t("teacher.students.aiEnabled") : t("teacher.students.aiDisabled")}
                        </button>
                      </td>
                    )}

                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(s.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => handleResetPassword(s)}
                          disabled={resettingId === s.id}
                          className="text-xs text-amber-600 hover:underline disabled:opacity-50"
                        >
                          {resettingId === s.id ? t("common.loading") : t("teacher.students.resetPassword.button")}
                        </button>
                        <Link href={`/teacher/students/${s.id}`} className="text-xs text-blue-600 hover:underline">
                          {t("teacher.students.viewResults")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats footer */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <span>{filtered.length} {t("teacher.students.footerCount")}</span>
        {canGrantAI && (
          <span>
            {students.filter(s => s.ai_assist_enabled).length} {t("teacher.students.footerAiCount")}
          </span>
        )}
      </div>
    </div>
  );
}

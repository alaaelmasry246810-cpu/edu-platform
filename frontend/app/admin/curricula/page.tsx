"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface CurriculumRow {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  total_pages: number;
  created_at: string;
  owner: { id: string; full_name: string; email: string; role: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  processing: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function AdminCurriculaPage() {
  const { t, dir, locale } = useI18n();
  const [rows, setRows] = useState<CurriculumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const STATUS_LABEL: Record<string, string> = {
    pending: t("admin.curricula.status.pending"),
    processing: t("admin.curricula.status.processing"),
    completed: t("admin.curricula.status.completed"),
    failed: t("admin.curricula.status.failed"),
  };
  const ROLE_LABEL: Record<string, string> = {
    teacher: t("admin.curricula.roles.teacher"),
    student: t("admin.curricula.roles.student"),
    admin: t("admin.curricula.roles.admin"),
  };

  const load = () => {
    setLoading(true);
    adminAPI.curricula(search ? { search } : {})
      .then(({ data }) => setRows(data))
      .catch(() => toast.error(t("admin.curricula.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeout = setTimeout(load, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleDelete = async (row: CurriculumRow) => {
    if (!confirm(t("admin.curricula.deleteConfirm", { title: row.title }))) return;
    setDeletingId(row.id);
    try {
      await adminAPI.deleteCurriculum(row.id);
      toast.success(t("admin.curricula.deleteSuccess"));
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch {
      toast.error(t("admin.curricula.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("admin.curricula.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("admin.curricula.subtitle")}</p>
        </div>
        <input
          type="text"
          placeholder={t("admin.curricula.searchPlaceholder")}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-4xl mb-3">📚</div>
          <p>{t("admin.curricula.noCurricula")}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900">
                  <th className="text-right px-4 py-3">{t("admin.curricula.columns.title")}</th>
                  <th className="text-right px-4 py-3">{t("admin.curricula.columns.owner")}</th>
                  <th className="text-right px-4 py-3">{t("admin.curricula.columns.status")}</th>
                  <th className="text-right px-4 py-3">{t("admin.curricula.columns.pages")}</th>
                  <th className="text-right px-4 py-3">{t("admin.curricula.columns.createdAt")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {r.title}
                      {r.subject && <span className="text-xs text-slate-400 block">{r.subject}{r.grade_level ? ` · ${r.grade_level}` : ""}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 dark:text-slate-300">{r.owner.full_name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        {r.owner.email}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{ROLE_LABEL[r.owner.role] ?? r.owner.role}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLORS[r.status])}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.total_pages}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={deletingId === r.id}
                        onClick={() => handleDelete(r)}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === r.id ? t("common.loading") : t("admin.curricula.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminUsersPage() {
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ full_name: string; email: string; temporary_password: string } | null>(null);

  const STATUS_LABELS: Record<string, string> = {
    pending: t("admin.users.status.pending"),
    active: t("admin.users.status.active"),
    suspended: t("admin.users.status.suspended"),
    rejected: t("admin.users.status.rejected"),
  };
  const PLAN_LABELS: Record<string, string> = {
    free: t("plans.free"),
    monthly: t("plans.monthly"),
    yearly: t("plans.yearly"),
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.plan = planFilter;
      const { data } = await adminAPI.users(params);
      setUsers(data);
    } catch {
      toast.error(t("admin.users.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [statusFilter, planFilter]);

  const updateUser = async (userId: string, updates: any) => {
    setUpdating(userId);
    try {
      await adminAPI.updateUser(userId, updates);
      toast.success(t("admin.users.updateSuccess"));
      fetchUsers();
    } catch {
      toast.error(t("admin.users.updateError"));
    } finally {
      setUpdating(null);
    }
  };

  const handleResetPassword = async (u: any) => {
    if (!confirm(t("admin.users.resetPassword.confirm", { name: u.full_name }))) return;
    setResetting(u.id);
    try {
      const { data } = await adminAPI.resetUserPassword(u.id);
      setResetResult({ full_name: u.full_name, email: u.email, temporary_password: data.temporary_password });
    } catch {
      toast.error(t("admin.users.resetPassword.error"));
    } finally {
      setResetting(null);
    }
  };

  const copyResetResult = () => {
    if (!resetResult) return;
    navigator.clipboard.writeText(`${resetResult.email}\n${resetResult.temporary_password}`);
    toast.success(t("admin.users.resetPassword.copied"));
  };

  return (
    <div>
      {/* One-time credentials modal */}
      {resetResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetResult(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <p className="text-2xl mb-2">🔑</p>
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">{t("admin.users.resetPassword.title", { name: resetResult.full_name })}</h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">{t("admin.users.resetPassword.oneTimeWarning")}</p>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-2 mb-4">
              <div className="text-sm"><span className="text-slate-400">{t("admin.users.columns.user")}: </span><span className="font-mono text-slate-800 dark:text-slate-200">{resetResult.email}</span></div>
              <div className="text-sm"><span className="text-slate-400">{t("admin.users.resetPassword.tempPassword")}: </span><span className="font-mono font-bold text-slate-800 dark:text-slate-200">{resetResult.temporary_password}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={copyResetResult} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">{t("admin.users.resetPassword.copyButton")}</button>
              <button onClick={() => setResetResult(null)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 rounded-lg text-sm font-medium">{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.users.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("admin.users.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("admin.users.allStatuses")}</option>
          <option value="pending">{t("admin.users.status.pending")}</option>
          <option value="active">{t("admin.users.status.active")}</option>
          <option value="suspended">{t("admin.users.status.suspended")}</option>
          <option value="rejected">{t("admin.users.status.rejected")}</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("admin.users.allPlans")}</option>
          <option value="free">{t("plans.free")}</option>
          <option value="monthly">{t("plans.monthly")}</option>
          <option value="yearly">{t("plans.yearly")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-right px-5 py-3 font-semibold">{t("admin.users.columns.user")}</th>
                <th className="text-right px-4 py-3 font-semibold">{t("admin.users.columns.status")}</th>
                <th className="text-right px-4 py-3 font-semibold">{t("admin.users.columns.plan")}</th>
                <th className="text-right px-4 py-3 font-semibold">{t("admin.users.columns.registeredAt")}</th>
                <th className="text-right px-4 py-3 font-semibold">{t("admin.users.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{u.full_name}</div>
                    <div className="text-slate-500 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", STATUS_COLORS[u.status])}>
                      {STATUS_LABELS[u.status]}
                    </span>
                    {u.suspension_reason === "devtools_detected" && (
                      <span className="ms-1.5 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" title={t("admin.users.autoSuspendHint")}>
                        🤖 {t("admin.users.autoSuspended")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{PLAN_LABELS[u.plan]}</td>
                  <td className="px-4 py-4 text-slate-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {u.status === "pending" && (
                        <>
                          <button
                            disabled={updating === u.id}
                            onClick={() => updateUser(u.id, { status: "active" })}
                            className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {t("admin.users.actions.approve")}
                          </button>
                          <button
                            disabled={updating === u.id}
                            onClick={() => updateUser(u.id, { status: "rejected" })}
                            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
                          >
                            {t("admin.users.actions.reject")}
                          </button>
                        </>
                      )}
                      {u.status === "active" && (
                        <button
                          disabled={updating === u.id}
                          onClick={() => updateUser(u.id, { status: "suspended" })}
                          className="text-xs bg-slate-600 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                        >
                          {t("admin.users.actions.suspend")}
                        </button>
                      )}
                      {(u.status === "suspended" || u.status === "rejected") && (
                        <button
                          disabled={updating === u.id}
                          onClick={() => updateUser(u.id, { status: "active" })}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {t("admin.users.actions.activate")}
                        </button>
                      )}
                      {u.plan !== "free" && (
                        <button
                          disabled={updating === u.id}
                          onClick={() => updateUser(u.id, { plan: "free" })}
                          className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                        >
                          {t("admin.users.actions.downgradeToFree")}
                        </button>
                      )}
                      <select
                        disabled={updating === u.id}
                        value={u.plan}
                        onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="free">{t("plans.free")}</option>
                        <option value="monthly">{t("plans.monthly")}</option>
                        <option value="yearly">{t("plans.yearly")}</option>
                      </select>
                      <button
                        disabled={resetting === u.id}
                        onClick={() => handleResetPassword(u)}
                        className="text-xs border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                      >
                        {resetting === u.id ? t("common.loading") : t("admin.users.resetPassword.button")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center text-slate-400 py-12">{t("admin.users.noUsers")}</div>
          )}
        </div>
      )}
    </div>
  );
}

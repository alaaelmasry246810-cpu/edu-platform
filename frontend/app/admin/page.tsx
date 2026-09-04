"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface Stats {
  total_users: number;
  pending_users: number;
  active_users: number;
  paid_users: number;
  total_curricula: number;
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className={clsx("bg-white dark:bg-slate-800 border rounded-2xl p-6 flex items-center gap-4", color)}>
      <div className="text-3xl">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value.toLocaleString()}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.stats()
      .then(({ data }) => setStats(data))
      .catch(() => toast.error(t("admin.stats.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const quickLinks = [
    { href: "/admin/users", icon: "👥", label: t("admin.stats.quickLinks.usersTitle"), desc: t("admin.stats.quickLinks.usersDesc") },
    { href: "/admin/plans", icon: "💰", label: t("admin.stats.quickLinks.plansTitle"), desc: t("admin.stats.quickLinks.plansDesc") },
    { href: "/admin/ai-settings", icon: "🤖", label: t("admin.stats.quickLinks.aiTitle"), desc: t("admin.stats.quickLinks.aiDesc") },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("admin.stats.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("admin.stats.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <StatCard label={t("admin.stats.totalUsers")} value={stats?.total_users ?? 0} icon="👥" color="border-slate-200 dark:border-slate-700" />
        <StatCard label={t("admin.stats.pendingUsers")} value={stats?.pending_users ?? 0} icon="⏳" color="border-amber-200 dark:border-amber-900" />
        <StatCard label={t("admin.stats.activeUsers")} value={stats?.active_users ?? 0} icon="✅" color="border-green-200 dark:border-green-900" />
        <StatCard label={t("admin.stats.paidUsers")} value={stats?.paid_users ?? 0} icon="💎" color="border-blue-200 dark:border-blue-900" />
        <StatCard label={t("admin.stats.totalCurricula")} value={stats?.total_curricula ?? 0} icon="📚" color="border-purple-200 dark:border-purple-900" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {quickLinks.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 hover:shadow-md transition-shadow block"
          >
            <div className="text-3xl mb-3">{item.icon}</div>
            <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">{item.label}</div>
            <div className="text-sm text-slate-500">{item.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

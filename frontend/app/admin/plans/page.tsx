"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";

export default function PlansPage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAPI.settings()
      .then(({ data }) => setSettings(data))
      .catch(() => toast.error(t("admin.plans.loadError")));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.saveSettings(settings);
      toast.success(t("admin.plans.saveSuccess"));
    } catch {
      toast.error(t("admin.plans.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: any) => setSettings((s: any) => ({ ...s, [key]: value }));

  if (!settings) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t("admin.plans.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("admin.plans.subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Free Plan */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">🆓</span> {t("admin.plans.freePlan")}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.pagesPerMonth")}</label>
              <input
                type="number" min={0}
                value={settings.free_pages_limit ?? 15}
                onChange={(e) => set("free_pages_limit", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.questionsPerDay")}</label>
              <input
                type="number" min={0}
                value={settings.free_questions_per_day ?? 20}
                onChange={(e) => set("free_questions_per_day", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.summariesPerMonth")}</label>
              <input
                type="number" min={0}
                value={settings.free_summaries_per_month ?? 10}
                onChange={(e) => set("free_summaries_per_month", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Monthly Plan */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">📅</span> {t("admin.plans.monthlyPlan")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.priceUsd")}</label>
              <input
                type="number" min={0} step={0.01}
                value={settings.monthly_price_usd ?? 9.99}
                onChange={(e) => set("monthly_price_usd", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.priceEgp")}</label>
              <input
                type="number" min={0}
                value={settings.monthly_price_egp ?? 299}
                onChange={(e) => set("monthly_price_egp", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Yearly Plan */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span> {t("admin.plans.yearlyPlan")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.priceUsd")}</label>
              <input
                type="number" min={0} step={0.01}
                value={settings.yearly_price_usd ?? 89.99}
                onChange={(e) => set("yearly_price_usd", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">{t("admin.plans.priceEgp")}</label>
              <input
                type="number" min={0}
                value={settings.yearly_price_egp ?? 2699}
                onChange={(e) => set("yearly_price_egp", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? t("admin.plans.saving") : t("admin.plans.saveChanges")}
        </button>
      </div>
    </div>
  );
}

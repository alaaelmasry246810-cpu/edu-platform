"use client";
import { useEffect, useState } from "react";
import { couponsAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_percent: number;
  max_uses?: number;
  times_used: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export default function AdminCouponsPage() {
  const { t, dir, locale } = useI18n();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_percent: 20,
    max_uses: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    couponsAPI.list()
      .then((r) => setCoupons(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await couponsAPI.create({
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_percent: Number(form.discount_percent),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: form.expires_at || null,
      });
      setShowForm(false);
      setForm({ code: "", description: "", discount_percent: 20, max_uses: "", expires_at: "" });
      load();
    } catch (e: any) {
      setError(e.response?.data?.detail || t("admin.coupons.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string) => {
    await couponsAPI.toggle(id);
    load();
  };

  const remove = async (id: string, code: string) => {
    if (!confirm(t("admin.coupons.deleteConfirm", { code }))) return;
    await couponsAPI.delete(id);
    load();
  };

  const columns = [
    t("admin.coupons.columns.code"),
    t("admin.coupons.columns.discount"),
    t("admin.coupons.columns.usage"),
    t("admin.coupons.columns.validity"),
    t("admin.coupons.columns.expiry"),
    t("admin.coupons.columns.status"),
    t("admin.coupons.columns.action"),
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto" dir={dir}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("admin.coupons.title")}</h1>
          <p className="text-slate-500 text-sm mt-1">{t("admin.coupons.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? t("admin.coupons.cancel") : t("admin.coupons.createCoupon")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">{t("admin.coupons.createFormTitle")}</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("admin.coupons.code")}</label>
              <input
                required
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder={t("admin.coupons.codePlaceholder")}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("admin.coupons.discountPercent")}</label>
              <input
                required
                type="number"
                min={1}
                max={100}
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("admin.coupons.description")}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("admin.coupons.descriptionPlaceholder")}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("admin.coupons.maxUses")}</label>
              <input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder={t("admin.coupons.maxUsesPlaceholder")}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t("admin.coupons.expiresAt")}</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {t("admin.coupons.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              {saving ? t("admin.coupons.saving") : t("admin.coupons.create")}
            </button>
          </div>
        </form>
      )}

      {/* Coupons table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">{t("admin.coupons.loading")}</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="text-slate-500">{t("admin.coupons.noCoupons")}</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-blue-600 hover:underline text-sm">
            {t("admin.coupons.createFirst")}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  {columns.map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {coupons.map((c) => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const exhausted = c.max_uses != null && c.times_used >= c.max_uses;

                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors ${!c.is_active ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">{c.code}</div>
                        {c.description && <div className="text-xs text-slate-400 mt-0.5">{c.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold">
                          {c.discount_percent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {c.times_used}
                        {c.max_uses != null && <span className="text-slate-400">/{c.max_uses}</span>}
                        {exhausted && <span className="mr-2 text-xs text-red-500">{t("admin.coupons.exhausted")}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          c.is_active && !expired && !exhausted
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-600"
                        }`}>
                          {c.is_active && !expired && !exhausted ? t("admin.coupons.active") : t("admin.coupons.disabled")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.expires_at
                          ? <span className={expired ? "text-red-500" : ""}>{new Date(c.expires_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}</span>
                          : <span className="text-slate-300">{t("admin.coupons.neverExpires")}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggle(c.id)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              c.is_active
                                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {c.is_active ? t("admin.coupons.deactivate") : t("admin.coupons.activate")}
                          </button>
                          <button
                            onClick={() => remove(c.id, c.code)}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          >
                            {t("admin.coupons.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

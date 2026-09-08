"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";

interface ServerSlot {
  slot: "local" | "cloud" | "future";
  label: string;
  url: string | null;
  notes: string | null;
  updated_at: string | null;
}

export default function AdminServersPage() {
  const { t, dir, locale } = useI18n();
  const [servers, setServers] = useState<ServerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  useEffect(() => {
    adminAPI.servers()
      .then(({ data }) => setServers(data))
      .catch(() => toast.error(t("admin.servers.loadError")))
      .finally(() => setLoading(false));
  }, []);

  const updateLocal = (slot: string, field: "label" | "url" | "notes", value: string) => {
    setServers(prev => prev.map(s => s.slot === slot ? { ...s, [field]: value } : s));
  };

  const handleSave = async (s: ServerSlot) => {
    setSavingSlot(s.slot);
    try {
      const { data } = await adminAPI.saveServer(s.slot, { label: s.label, url: s.url || undefined, notes: s.notes || undefined });
      setServers(prev => prev.map(x => x.slot === s.slot ? data : x));
      toast.success(t("admin.servers.saveSuccess"));
    } catch {
      toast.error(t("admin.servers.saveError"));
    } finally {
      setSavingSlot(null);
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("admin.servers.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("admin.servers.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {servers.map((s) => (
          <div key={s.slot} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <h2 className="font-bold text-slate-800 dark:text-white mb-3">
              {t(`admin.servers.slots.${s.slot}`)}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("admin.servers.labelPlaceholder")}</label>
                <input
                  type="text"
                  value={s.label}
                  onChange={e => updateLocal(s.slot, "label", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
                <input
                  type="text"
                  placeholder={t("admin.servers.urlPlaceholder")}
                  value={s.url || ""}
                  onChange={e => updateLocal(s.slot, "url", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("admin.servers.notesPlaceholder")}</label>
                <textarea
                  rows={3}
                  value={s.notes || ""}
                  onChange={e => updateLocal(s.slot, "notes", e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-slate-400">
                {s.updated_at
                  ? `${t("admin.servers.lastUpdated")}: ${new Date(s.updated_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}`
                  : t("admin.servers.neverUpdated")}
              </span>
              <button
                onClick={() => handleSave(s)}
                disabled={savingSlot === s.slot}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-medium"
              >
                {savingSlot === s.slot ? t("admin.servers.saving") : t("admin.servers.save")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

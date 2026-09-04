"use client";
import { useEffect, useState } from "react";
import { adminAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

export default function AISettingsPage() {
  const { t } = useI18n();

  const AI_MODELS = [
    { value: "gpt-4o", label: "GPT-4o", desc: t("admin.aiSettings.models.gpt4o") },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: t("admin.aiSettings.models.gpt4oMini") },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", desc: t("admin.aiSettings.models.claude35") },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", desc: t("admin.aiSettings.models.gemini15") },
  ];

  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAPI.settings()
      .then(({ data }) => setSettings(data))
      .catch(() => toast.error(t("admin.aiSettings.loadError")));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.saveSettings(settings);
      toast.success(t("admin.aiSettings.saveSuccess"));
    } catch {
      toast.error(t("admin.aiSettings.saveError"));
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
        <h1 className="text-2xl font-bold">{t("admin.aiSettings.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("admin.aiSettings.subtitle")}</p>
      </div>

      <div className="space-y-6">
        {/* Model selection */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">{t("admin.aiSettings.modelSectionTitle")}</h2>
          <div className="space-y-2">
            {AI_MODELS.map((m) => (
              <label
                key={m.value}
                className={clsx(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                  settings.ai_model === m.value
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                )}
              >
                <input
                  type="radio" name="ai_model"
                  value={m.value}
                  checked={settings.ai_model === m.value}
                  onChange={() => set("ai_model", m.value)}
                  className="accent-blue-600"
                />
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{m.label}</div>
                  <div className="text-xs text-slate-500">{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* RAG Settings */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">{t("admin.aiSettings.ragSectionTitle")}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">
                {t("admin.aiSettings.ragTopK")}
                <span className="text-slate-400 font-normal">{t("admin.aiSettings.ragTopKHint")}</span>
              </label>
              <input
                type="number" min={1} max={20}
                value={settings.rag_top_k ?? 8}
                onChange={(e) => set("rag_top_k", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">
                {t("admin.aiSettings.chunkSize")}
              </label>
              <input
                type="number" min={100} max={2000} step={100}
                value={settings.rag_chunk_size ?? 800}
                onChange={(e) => set("rag_chunk_size", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-slate-600">
                {t("admin.aiSettings.chunkOverlap")}
              </label>
              <input
                type="number" min={0} max={500} step={50}
                value={settings.rag_chunk_overlap ?? 100}
                onChange={(e) => set("rag_chunk_overlap", +e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Temperature */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-4">{t("admin.aiSettings.temperatureTitle")}</h2>
          <div className="space-y-3">
            <input
              type="range" min={0} max={1} step={0.1}
              value={settings.temperature ?? 0.3}
              onChange={(e) => set("temperature", +e.target.value)}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>{t("admin.aiSettings.temperaturePrecise")}</span>
              <span className="font-bold text-blue-600">{settings.temperature ?? 0.3}</span>
              <span>{t("admin.aiSettings.temperatureCreative")}</span>
            </div>
            <p className="text-xs text-slate-400">{t("admin.aiSettings.temperatureHint")}</p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? t("admin.aiSettings.saving") : t("admin.aiSettings.save")}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { curriculumAPI, aiAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";

export default function SummaryPage() {
  const { t } = useI18n();
  const [curricula, setCurricula] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [terms, setTerms] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    curriculumAPI.list().then(({ data }) =>
      setCurricula(data.filter((c: any) => c.status === "completed"))
    );
  }, []);

  const loadTerms = async (id: string) => {
    if (!id) return;
    setSelectedId(id);
    setTerms(null);
    setLoading(true);
    try {
      const { data } = await aiAPI.allTerms(id);
      setTerms(data.key_terms);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.summary.error"));
    } finally {
      setLoading(false);
    }
  };

  const filtered = terms
    ? Object.entries(terms).filter(
        ([term, def]) =>
          !search ||
          term.toLowerCase().includes(search.toLowerCase()) ||
          (def as string).toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t("dashboard.summary.title")}</h1>
      <p className="text-slate-500 text-sm mb-8">{t("dashboard.summary.subtitle")}</p>

      <div className="flex gap-4 mb-6">
        <select
          value={selectedId}
          onChange={(e) => loadTerms(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t("dashboard.summary.selectPlaceholder")}</option>
          {curricula.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        {terms && (
          <input
            type="text"
            placeholder={t("dashboard.summary.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 justify-center py-24 text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          {t("dashboard.summary.loading")}
        </div>
      ) : terms ? (
        <>
          <div className="text-xs text-slate-500 mb-4">
            {t("dashboard.summary.count", { count: filtered.length })}
            {search && ` ${t("dashboard.summary.countOf", { total: Object.keys(terms).length })}`}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map(([term, def]) => (
              <div
                key={term}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                <div className="font-bold text-blue-700 dark:text-blue-400 mb-1.5">{term}</div>
                <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{def as string}</div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center text-slate-400 py-12">{t("dashboard.summary.noResults")}</div>
          )}
        </>
      ) : (
        <div className="text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-24">
          <div className="text-4xl mb-3">🔑</div>
          <p className="text-slate-500">{t("dashboard.summary.empty")}</p>
        </div>
      )}
    </div>
  );
}

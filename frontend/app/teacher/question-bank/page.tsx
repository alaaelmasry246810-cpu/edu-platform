"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface SharedQuestion {
  id: string;
  teacher_id: string;
  is_mine: boolean;
  question: string;
  question_type: string;
  correct_answer: string | null;
  options: string[] | null;
  explanation: string | null;
  difficulty: string;
  subject_tag: string | null;
  grade_level: string | null;
  points: number;
  is_public: boolean;
  use_count: number;
  created_at: string;
}

const bankAPI = {
  browse:  (params?: object) => api.get("/question-bank", { params }),
  my:      ()               => api.get("/question-bank/my"),
  publish: (data: object)   => api.post("/question-bank", data),
  delete:  (id: string)     => api.delete(`/question-bank/${id}`),
  import:  (id: string)     => api.post(`/question-bank/${id}/import`),
};

const EMPTY_FORM = {
  question: "", question_type: "mcq", correct_answer: "",
  options: ["", "", "", ""], explanation: "", difficulty: "medium",
  subject_tag: "", grade_level: "", points: 2, is_public: true,
};

export default function QuestionBankPage() {
  const { t, dir } = useI18n();
  const [tab, setTab] = useState<"browse" | "my" | "publish">("browse");
  const [questions, setQuestions] = useState<SharedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [diffFilter, setDiffFilter] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<Set<string>>(new Set());

  const TYPE_LABELS: Record<string, string> = {
    mcq: t("teacher.questionBank.types.mcq"),
    true_false: t("teacher.questionBank.types.true_false"),
    fill_blank: t("teacher.questionBank.types.fill_blank"),
    why: t("teacher.questionBank.types.why"),
    essay: t("teacher.questionBank.types.essay"),
  };
  const DIFF_LABELS: Record<string, { label: string; color: string }> = {
    easy:   { label: t("teacher.questionBank.difficulty.easy"),   color: "text-green-700 bg-green-100" },
    medium: { label: t("teacher.questionBank.difficulty.medium"), color: "text-amber-700 bg-amber-100" },
    hard:   { label: t("teacher.questionBank.difficulty.hard"),   color: "text-red-700 bg-red-100" },
  };

  const fetchBrowse = async () => {
    setLoading(true);
    try {
      const { data } = await bankAPI.browse({
        search: search || undefined,
        question_type: typeFilter || undefined,
        difficulty: diffFilter || undefined,
        limit: 50,
      });
      setQuestions(data.questions);
    } catch { toast.error(t("teacher.questionBank.loadError")); }
    finally { setLoading(false); }
  };

  const fetchMy = async () => {
    setLoading(true);
    try {
      const { data } = await bankAPI.my();
      setQuestions(data);
    } catch { toast.error(t("teacher.questionBank.loadError")); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === "browse") fetchBrowse();
    if (tab === "my") fetchMy();
  }, [tab]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) { toast.error(t("teacher.questionBank.questionRequired")); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        options: form.question_type === "mcq" ? form.options.filter(Boolean) : null,
        correct_answer: form.correct_answer || null,
        subject_tag: form.subject_tag || null,
        grade_level: form.grade_level || null,
        explanation: form.explanation || null,
      };
      await bankAPI.publish(body);
      toast.success(t("teacher.questionBank.publishSuccess"));
      setForm({ ...EMPTY_FORM });
      setTab("my");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.questionBank.publishError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await bankAPI.delete(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast.success(t("teacher.questionBank.deleteSuccess"));
    } catch { toast.error(t("teacher.questionBank.deleteError")); }
  };

  const handleImport = async (q: SharedQuestion) => {
    try {
      await bankAPI.import(q.id);
      setImported(prev => new Set([...prev, q.id]));
      toast.success(t("teacher.questionBank.importSuccess"));
    } catch { toast.error(t("teacher.questionBank.importError")); }
  };

  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.questionBank.title")}</h1>
        <p className="text-slate-500 text-sm mt-1">{t("teacher.questionBank.subtitle")}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {[
          { key: "browse", label: t("teacher.questionBank.tabs.browse") },
          { key: "my",     label: t("teacher.questionBank.tabs.my") },
          { key: "publish", label: t("teacher.questionBank.tabs.publish") },
        ].map(tabItem => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key as any)}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === tabItem.key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Browse tab */}
      {tab === "browse" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchBrowse()}
              placeholder={t("teacher.questionBank.searchPlaceholder")}
              className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none">
              <option value="">{t("teacher.questionBank.allTypes")}</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)} className="border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 focus:outline-none">
              <option value="">{t("teacher.questionBank.allLevels")}</option>
              {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={fetchBrowse} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              {t("teacher.questionBank.searchBtn")}
            </button>
          </div>
          <QuestionList questions={questions} loading={loading} onImport={handleImport} imported={imported} onDelete={undefined} t={t} typeLabels={TYPE_LABELS} diffLabels={DIFF_LABELS} />
        </div>
      )}

      {/* My questions tab */}
      {tab === "my" && (
        <QuestionList questions={questions} loading={loading} onImport={undefined} imported={imported} onDelete={handleDelete} t={t} typeLabels={TYPE_LABELS} diffLabels={DIFF_LABELS} />
      )}

      {/* Publish tab */}
      {tab === "publish" && (
        <form onSubmit={handlePublish} className="max-w-2xl space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.questionLabel")}</label>
            <textarea rows={3} required value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              className={inputCls + " resize-none"} placeholder={t("teacher.questionBank.form.questionPlaceholder")} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.typeLabel")}</label>
              <select value={form.question_type} onChange={e => setForm(f => ({ ...f, question_type: e.target.value }))} className={inputCls}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.difficultyLabel")}</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className={inputCls}>
                {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.pointsLabel")}</label>
              <input type="number" step={0.5} min={0.5} value={form.points}
                onChange={e => setForm(f => ({ ...f, points: parseFloat(e.target.value) || 2 }))}
                className={inputCls} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.subjectLabel")}</label>
              <input value={form.subject_tag} onChange={e => setForm(f => ({ ...f, subject_tag: e.target.value }))}
                className={inputCls} placeholder={t("teacher.questionBank.form.subjectPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.gradeLabel")}</label>
              <input value={form.grade_level} onChange={e => setForm(f => ({ ...f, grade_level: e.target.value }))}
                className={inputCls} placeholder={t("teacher.questionBank.form.gradePlaceholder")} />
            </div>
          </div>

          {form.question_type === "mcq" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.optionsLabel")}</label>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 w-6">{String.fromCharCode(0x0623 + i)})</span>
                    <input value={opt} onChange={e => {
                      const opts = [...form.options];
                      opts[i] = e.target.value;
                      setForm(f => ({ ...f, options: opts }));
                    }} className={inputCls} placeholder={t("teacher.questionBank.form.optionPlaceholder", { n: i + 1 })} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.correctAnswerLabel")}</label>
            <input value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
              className={inputCls} placeholder={t("teacher.questionBank.form.correctAnswerPlaceholder")} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t("teacher.questionBank.form.explanationLabel")}</label>
            <textarea rows={2} value={form.explanation}
              onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
              className={inputCls + " resize-none"} placeholder={t("teacher.questionBank.form.explanationPlaceholder")} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_public" checked={form.is_public}
              onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <label htmlFor="is_public" className="text-sm text-slate-600 dark:text-slate-400">
              {t("teacher.questionBank.form.isPublicLabel")}
            </label>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-60">
            {saving ? t("teacher.questionBank.form.submitting") : t("teacher.questionBank.form.submit")}
          </button>
        </form>
      )}
    </div>
  );
}

function QuestionList({
  questions, loading, onImport, onDelete, imported, t, typeLabels, diffLabels,
}: {
  questions: SharedQuestion[];
  loading: boolean;
  onImport?: (q: SharedQuestion) => void;
  onDelete?: (id: string) => void;
  imported: Set<string>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  typeLabels: Record<string, string>;
  diffLabels: Record<string, { label: string; color: string }>;
}) {
  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!questions.length) return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-4xl mb-2">📭</div>
      <p>{t("teacher.questionBank.emptyList")}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {questions.map(q => {
        const diff = diffLabels[q.difficulty] ?? diffLabels.medium;
        const typeLabel = typeLabels[q.question_type] ?? q.question_type;
        return (
          <div key={q.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{typeLabel}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${diff.color} dark:opacity-80`}>{diff.label}</span>
                  {q.subject_tag && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{q.subject_tag}</span>}
                  {q.grade_level && <span className="text-xs text-slate-400">{q.grade_level}</span>}
                  <span className="text-xs text-slate-400 mr-auto">{t("teacher.questionBank.importsCount", { n: q.use_count })}</span>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">{q.question}</p>
                {q.options && (
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt, i) => (
                      <span key={i} className={clsx("block text-xs text-slate-500", q.correct_answer === opt && "font-bold text-green-600 dark:text-green-400")}>
                        {String.fromCharCode(0x0623 + i)}) {opt} {q.correct_answer === opt && "✅"}
                      </span>
                    ))}
                  </div>
                )}
                {q.correct_answer && !q.options && (
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">{t("teacher.questionBank.correctAnswerShown", { answer: q.correct_answer })}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {onImport && (
                  <button
                    onClick={() => onImport(q)}
                    disabled={imported.has(q.id)}
                    className={clsx(
                      "text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors",
                      imported.has(q.id)
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    {imported.has(q.id) ? t("teacher.questionBank.importedDone") : t("teacher.questionBank.imports")}
                  </button>
                )}
                {onDelete && q.is_mine && (
                  <button onClick={() => onDelete(q.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                    {t("teacher.questionBank.delete")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

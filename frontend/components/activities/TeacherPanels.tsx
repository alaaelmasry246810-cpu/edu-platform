"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI, assignmentAPI, curriculumAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { type Item, type TemplateKey, TEMPLATE_ICONS, SOLO_TEMPLATES } from "./shared";
import { QRCodeSVG } from "qrcode.react";
import { LeaderboardPanel, fmtTime } from "./Leaderboard";

const inputCls = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ── Editor ───────────────────────────────────────────────────

interface EditorProps {
  activity?: any;                       // undefined → creating
  initialCurriculumId?: string;
  initialLessonId?: string;
  onSaved: (activity: any) => void;
}

export function ActivityEditor({ activity, initialCurriculumId, initialLessonId, onSaved }: EditorProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [items, setItems] = useState<Item[]>(activity?.items ?? []);
  const [template, setTemplate] = useState<TemplateKey>(activity?.template ?? "quiz");
  const [isPublic, setIsPublic] = useState<boolean>(activity?.is_public ?? false);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [curriculumId, setCurriculumId] = useState(activity?.curriculum_id ?? initialCurriculumId ?? "");
  const [units, setUnits] = useState<any[]>([]);
  const [lessonId, setLessonId] = useState(activity?.lesson_id ?? initialLessonId ?? "");
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState<"" | "ai" | "cards" | "save">("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => { curriculumAPI.list().then(({ data }) => setCurricula(data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!curriculumId) { setUnits([]); return; }
    curriculumAPI.structure(curriculumId).then(({ data }) => setUnits(data.units ?? [])).catch(() => setUnits([]));
  }, [curriculumId]);

  const lessonTitle = units.flatMap((u) => u.lessons).find((l: any) => l.id === lessonId)?.title;

  const generate = async () => {
    if (!curriculumId) return toast.error(t("games.editor.pickCurriculum"));
    setBusy("ai");
    try {
      const { data } = await activitiesAPI.generate({ curriculum_id: curriculumId, lesson_id: lessonId || undefined, count });
      setItems((xs) => [...xs, ...data.items]);
      if (!title && lessonTitle) setTitle(lessonTitle);
      toast.success(t("games.editor.generated", { n: data.items.length }));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("games.editor.error"));
    } finally { setBusy(""); }
  };

  const fromCards = async () => {
    if (!lessonId) return toast.error(t("games.editor.pickLesson"));
    setBusy("cards");
    try {
      const { data } = await activitiesAPI.fromFlashcards(lessonId);
      if (!data.items.length) toast.error(t("games.editor.noCards"));
      setItems((xs) => [...xs, ...data.items]);
    } catch { toast.error(t("games.editor.error")); } finally { setBusy(""); }
  };

  // "question | answer | wrong1 | wrong2 …" per line (or tab-separated, e.g. pasted from a spreadsheet).
  const addBulk = () => {
    const parsed = bulk.split("\n").map((line) => line.split(/\t|\|/).map((s) => s.trim()).filter(Boolean))
      .filter((p) => p.length >= 2).map(([q, a, ...wrong]) => ({ q, a, ...(wrong.length ? { options: [a, ...wrong] } : {}) }));
    setItems((xs) => [...xs, ...parsed]); setBulk(""); setShowBulk(false);
  };

  const update = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const setWrong = (i: number, text: string) => {
    const wrong = text.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
    update(i, { options: wrong.length ? [items[i].a, ...wrong] : undefined });
  };

  const save = async () => {
    const clean = items.filter((it) => it.q.trim() && it.a.trim());
    if (!title.trim()) return toast.error(t("games.editor.needTitle"));
    if (clean.length < 2) return toast.error(t("games.needItems"));
    setBusy("save");
    const body = { title, description, items: clean, template, is_public: isPublic, curriculum_id: curriculumId || null, lesson_id: lessonId || null };
    try {
      const { data } = activity ? await activitiesAPI.update(activity.id, body) : await activitiesAPI.create(body);
      toast.success(t("games.editor.saved"));
      onSaved(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("games.editor.error"));
    } finally { setBusy(""); }
  };

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("games.editor.title")} className={inputCls} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("games.editor.description")} className={inputCls} />
      </div>

      {/* Source: lesson + AI / flashcards */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-800/50">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">✨ {t("games.editor.fromLesson")}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select value={curriculumId} onChange={(e) => { setCurriculumId(e.target.value); setLessonId(""); }} className={inputCls}>
            <option value="">{t("games.editor.curriculum")}</option>
            {curricula.filter((c) => c.content_type !== "exam").map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className={inputCls} disabled={!units.length}>
            <option value="">{t("games.editor.lesson")}</option>
            {units.map((u) => (
              <optgroup key={u.id} label={u.title}>
                {u.lessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
            {t("games.editor.count")}
            <input type="number" min={4} max={40} value={count} onChange={(e) => setCount(+e.target.value)} className={inputCls + " w-20"} />
          </label>
          <button onClick={generate} disabled={!!busy} className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold disabled:opacity-60">
            {busy === "ai" ? t("games.editor.generating") : `🤖 ${t("games.editor.generate")}`}
          </button>
          <button onClick={fromCards} disabled={!!busy || !lessonId} className="px-4 py-2 rounded-xl border-2 border-violet-300 text-violet-700 dark:text-violet-300 text-sm font-bold disabled:opacity-50">
            🃏 {t("games.editor.fromCards")}
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("games.editor.items", { n: items.length })}</p>
          <button onClick={() => setShowBulk((s) => !s)} className="text-sm text-blue-600 hover:underline">📋 {t("games.editor.bulk")}</button>
        </div>
        {showBulk && (
          <div className="space-y-2">
            <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={5} className={inputCls} placeholder={t("games.editor.bulkPlaceholder")} />
            <button onClick={addBulk} className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm">{t("games.editor.addBulk")}</button>
          </div>
        )}
        {items.map((it, i) => (
          // Keyed by list length so the uncontrolled "wrong options" field resets when rows are added/removed.
          <div key={`${i}-${items.length}`} className="grid grid-cols-[1.5rem,1fr,1fr,auto] sm:grid-cols-[1.5rem,2fr,1fr,1.5fr,auto] gap-2 items-center">
            <span className="text-xs text-slate-400 text-center">{i + 1}</span>
            <input value={it.q} onChange={(e) => update(i, { q: e.target.value })} placeholder={t("games.editor.question")} className={inputCls} />
            <input value={it.a} onChange={(e) => {
              const a = e.target.value;
              update(i, { a, options: it.options ? [a, ...it.options.filter((o) => o !== it.a)] : undefined });
            }} placeholder={t("games.editor.answer")} className={inputCls + " font-semibold"} />
            <input defaultValue={(it.options ?? []).filter((o) => o !== it.a).join("، ")} onBlur={(e) => setWrong(i, e.target.value)}
              placeholder={t("games.editor.wrongOptions")} className={inputCls + " hidden sm:block"} />
            <button onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} className="text-red-400 hover:text-red-600 px-1">✕</button>
          </div>
        ))}
        <button onClick={() => setItems((xs) => [...xs, { q: "", a: "" }])} className="text-sm text-blue-600 hover:underline">+ {t("games.editor.addItem")}</button>
      </div>

      {/* Defaults */}
      <div className="grid sm:grid-cols-2 gap-3 items-center">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          {t("games.editor.defaultTemplate")}
          <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateKey)} className={inputCls + " mt-1"}>
            {[...SOLO_TEMPLATES, "teamboard" as TemplateKey].map((k) => <option key={k} value={k}>{TEMPLATE_ICONS[k]} {t(`games.templates.${k}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          🌍 {t("games.editor.public")}
        </label>
      </div>

      <button onClick={save} disabled={!!busy} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60">
        {busy === "save" ? t("games.editor.saving") : t("games.editor.save")}
      </button>
    </div>
  );
}

// ── Assign as homework (Quizizz-style) ───────────────────────

export function AssignPanel({ activity, onSaved }: { activity: any; onSaved: (a: any) => void }) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<boolean>(activity.assigned);
  const [groupId, setGroupId] = useState<string>(activity.group_id ?? "");
  const [dueAt, setDueAt] = useState<string>(activity.due_at ? activity.due_at.slice(0, 16) : "");
  const [powerUps, setPowerUps] = useState<boolean>(activity.power_ups);
  const [seconds, setSeconds] = useState<number>(activity.time_per_question ?? 20);
  const [calm, setCalm] = useState<boolean>(!!activity.calm_mode);
  const [gameMinutes, setGameMinutes] = useState<number>(activity.game_minutes ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { assignmentAPI.listGroups().then(({ data }) => setGroups(data)).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await activitiesAPI.update(activity.id, {
        assigned, group_id: groupId || null, due_at: dueAt ? new Date(dueAt).toISOString() : null,
        power_ups: powerUps, time_per_question: seconds, calm_mode: calm, game_minutes: gameMinutes || null,
      });
      toast.success(assigned ? t("games.assign.assigned") : t("games.assign.saved"));
      onSaved(data);
    } catch { toast.error(t("games.editor.error")); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl space-y-4">
      <label className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 cursor-pointer">
        <input type="checkbox" checked={assigned} onChange={(e) => setAssigned(e.target.checked)} className="w-5 h-5" />
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">📝 {t("games.assign.toggle")}</p>
          <p className="text-xs text-slate-500">{t("games.assign.toggleHint")}</p>
        </div>
      </label>
      <div className={clsx("space-y-3", !assigned && "opacity-50 pointer-events-none")}>
        <label className="block text-sm text-slate-600 dark:text-slate-300">{t("games.assign.who")}
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls + " mt-1"}>
            <option value="">{t("games.assign.allStudents")}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="block text-sm text-slate-600 dark:text-slate-300">{t("games.assign.due")}
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls + " mt-1"} />
        </label>
        <label className="block text-sm text-slate-600 dark:text-slate-300">{t("games.assign.seconds", { n: seconds })}
          <input type="range" min={5} max={90} step={5} value={seconds} onChange={(e) => setSeconds(+e.target.value)} className="w-full mt-2" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={powerUps} onChange={(e) => setPowerUps(e.target.checked)} /> ⚡ {t("games.assign.powerUps")}
        </label>
      </div>
      {/* These apply wherever the activity is played, assigned or not. */}
      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" checked={calm} onChange={(e) => setCalm(e.target.checked)} className="mt-1" />
        <span>🧘 {t("games.assign.calm")}<span className="block text-xs text-slate-500">{t("games.assign.calmHint")}</span></span>
      </label>
      <label className="block text-sm text-slate-600 dark:text-slate-300">
        ⏳ {gameMinutes ? t("games.assign.gameMinutes", { n: gameMinutes }) : t("games.assign.noLimit")}
        <input type="range" min={0} max={20} value={gameMinutes} onChange={(e) => setGameMinutes(+e.target.value)} className="w-full mt-2" />
        <span className="block text-xs text-slate-500">{t("games.assign.gameMinutesHint")}</span>
      </label>
      <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">{t("games.editor.save")}</button>
    </div>
  );
}

// ── Report ───────────────────────────────────────────────────

export function ReportPanel({ activityId }: { activityId: string }) {
  const { t } = useI18n();
  const [report, setReport] = useState<any>(null);
  useEffect(() => { activitiesAPI.report(activityId).then(({ data }) => setReport(data)).catch(() => setReport({ students: [], items: [], total_attempts: 0 })); }, [activityId]);
  if (!report) return <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  if (!report.total_attempts) return <p className="text-center text-slate-500 py-10">{t("games.report.empty")}</p>;
  const hardest = [...report.items].filter((x: any) => x.accuracy !== null).sort((a: any, b: any) => a.accuracy - b.accuracy).slice(0, 3);

  return (
    <div className="space-y-6">
      <LeaderboardPanel load={() => activitiesAPI.leaderboard(activityId)} />
      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label={t("games.report.attempts")} value={report.total_attempts} />
        <Stat label={t("games.report.students")} value={report.students.length} />
        <Stat label={t("games.report.avg")} value={`${Math.round(report.students.reduce((n: number, s: any) => n + s.best_pct, 0) / Math.max(1, report.students.length))}%`} />
      </div>
      {hardest.length > 0 && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="font-bold text-amber-800 dark:text-amber-200 mb-2">⚠️ {t("games.report.hardest")}</p>
          {hardest.map((x: any, k: number) => (
            <p key={k} className="text-sm text-amber-900 dark:text-amber-100">{x.q} — <b>{x.accuracy}%</b>{x.top_wrong && <span className="opacity-80"> · {t("games.report.commonWrong", { a: x.top_wrong })}</span>}</p>
          ))}
        </div>
      )}
      <div>
        <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">{t("games.report.byStudent")}</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500"><tr>
              <th className="p-2 text-start">{t("games.report.student")}</th><th className="p-2">{t("games.report.best")}</th>
              <th className="p-2">{t("games.report.score")}</th><th className="p-2">{t("games.report.time")}</th><th className="p-2">{t("games.report.attempts")}</th></tr></thead>
            <tbody>
              {report.students.map((s: any, k: number) => (
                <tr key={k} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-medium">{s.name}{s.guest && <span className="ms-1 text-[10px] text-slate-400">{t("games.leaderboard.guest")}</span>}
                    {s.guest && (s.phone || s.class) && <span className="block text-[11px] font-normal text-slate-400" dir="auto">{[s.class, s.phone].filter(Boolean).join(" · ")}</span>}</td>
                  <td className="p-2 text-center"><span className={clsx("font-bold", s.best_pct >= 75 ? "text-green-600" : s.best_pct >= 50 ? "text-amber-600" : "text-red-500")}>{s.best_pct}%</span></td>
                  <td className="p-2 text-center">{s.best_score}</td>
                  <td className="p-2 text-center tabular-nums">{s.best_time != null ? fmtTime(s.best_time) : "—"}</td>
                  <td className="p-2 text-center">{s.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">{t("games.report.byQuestion")}</h4>
        <div className="space-y-2">
          {report.items.map((x: any, k: number) => (
            <div key={k} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate">{k + 1}. {x.q}</span><span className="font-bold">{x.accuracy ?? "—"}{x.accuracy !== null && "%"}</span></div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1">
                <div className={clsx("h-full", (x.accuracy ?? 0) >= 75 ? "bg-green-500" : (x.accuracy ?? 0) >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${x.accuracy ?? 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center">
      <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ── Share link (the teacher controls who can open it) ────────

export function SharePanel({ activity, onSaved }: { activity: any; onSaved: (a: any) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const link = activity.share_token && typeof window !== "undefined" ? `${window.location.origin}/a/${activity.share_token}` : "";

  const update = async (patch: object, ok?: string) => {
    setBusy(true);
    try {
      const { data } = await activitiesAPI.update(activity.id, patch);
      onSaved(data);
      if (ok) toast.success(ok);
    } catch { toast.error(t("games.editor.error")); } finally { setBusy(false); }
  };
  const regenerate = async () => {
    if (!confirm(t("games.share.regenerateConfirm"))) return;
    setBusy(true);
    try { const { data } = await activitiesAPI.regenerateLink(activity.id); onSaved(data); toast.success(t("games.share.regenerated")); }
    catch { toast.error(t("games.editor.error")); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success(t("games.share.copied")); }
    catch { window.prompt(t("games.share.copyManually"), link); }
  };

  const Toggle = ({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) => (
    <label className={clsx("flex items-start gap-3 rounded-2xl border-2 p-4 cursor-pointer", checked ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/10" : "border-slate-200 dark:border-slate-700")}>
      <input type="checkbox" checked={checked} disabled={busy} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 mt-0.5" />
      <div><p className="font-bold text-slate-800 dark:text-slate-100">{title}</p><p className="text-xs text-slate-500">{hint}</p></div>
    </label>
  );

  return (
    <div className="max-w-2xl space-y-4">
      <Toggle checked={!!activity.link_enabled} onChange={(v) => update({ link_enabled: v }, v ? t("games.share.enabled") : t("games.share.disabled"))}
        title={`🔗 ${t("games.share.toggle")}`} hint={t("games.share.toggleHint")} />

      {activity.link_enabled && link && (
        <>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-4">
            <QRCodeSVG value={link} size={112} className="shrink-0 bg-white p-1 rounded" />
            <div className="flex-1 min-w-[14rem] space-y-2">
              <input readOnly value={link} dir="ltr" onFocus={(e) => e.target.select()} className={inputCls + " font-mono text-xs"} />
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">📋 {t("games.share.copy")}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${activity.title}\n${link}`)}`} target="_blank" rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">💬 {t("games.share.whatsapp")}</a>
                <button onClick={regenerate} disabled={busy} className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-600 dark:text-slate-300">🔄 {t("games.share.regenerate")}</button>
              </div>
            </div>
          </div>
          <Toggle checked={activity.allow_guests !== false} onChange={(v) => update({ allow_guests: v })}
            title={`👥 ${t("games.share.guests")}`} hint={t("games.share.guestsHint")} />
        </>
      )}

      <Toggle checked={activity.leaderboard_visible !== false} onChange={(v) => update({ leaderboard_visible: v })}
        title={`🏆 ${t("games.share.leaderboard")}`} hint={t("games.share.leaderboardHint")} />
    </div>
  );
}

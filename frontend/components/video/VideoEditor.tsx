"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { videosAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Interaction, Scene } from "./InteractivePlayer";

interface Props {
  video: any;
  onChange: (video: any) => void;
  onDeleted: (id: string) => void;
}

const inputCls = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function VideoEditor({ video, onChange, onDeleted }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState(video.title);
  const [scenes, setScenes] = useState<Scene[]>(video.scenes);
  const [items, setItems] = useState<Interaction[]>(video.interactions);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<"questions" | "scenes">("questions");
  const isAI = video.source === "ai";
  const ready = video.status === "completed";

  useEffect(() => {
    setTitle(video.title); setScenes(video.scenes); setItems(video.interactions);
  }, [video.id, video.status, video.scenes, video.interactions]);

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setSaving(true);
    try {
      const { data } = await fn();
      if (data?.id) onChange(data);
      if (ok) toast.success(ok);
      return data;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("video.editor.error"));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const data = await run(() => videosAPI.update(video.id, { title, scenes, interactions: items }), t("video.editor.saved"));
    // Edited AI narration lost its audio → voice those scenes again.
    if (data && isAI && data.scenes.some((s: Scene) => !s.audio_url)) {
      await run(() => videosAPI.regenerateAudio(video.id, true), t("video.editor.audioUpdated"));
    }
  };

  const togglePublish = () =>
    run(() => videosAPI.update(video.id, { is_published: !video.is_published }),
      video.is_published ? t("video.editor.unpublished") : t("video.editor.published"));

  const regenerate = () => {
    if (!confirm(t("video.editor.regenerateConfirm"))) return;
    run(() => videosAPI.regenerate(video.id, isAI ? Math.max(3, scenes.length) : undefined));
  };

  const remove = async () => {
    if (!confirm(t("video.editor.deleteConfirm"))) return;
    try {
      await videosAPI.delete(video.id);
      onDeleted(video.id);
      toast.success(t("video.editor.deleted"));
    } catch {
      toast.error(t("video.editor.error"));
    }
  };

  const updateItem = (i: number, patch: Partial<Interaction>) =>
    setItems((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const updateScene = (i: number, patch: Partial<Scene>) =>
    // Changing the narration drops its audio so it gets re-voiced on save.
    setScenes((xs) => xs.map((x, k) => (k === i ? { ...x, ...patch, ...(patch.narration !== undefined ? { audio_url: undefined } : {}) } : x)));

  const addItem = () =>
    setItems((xs) => [...xs, {
      id: Math.random().toString(36).slice(2, 12),
      type: "mcq",
      question: "",
      options: ["", "", "", ""],
      correct_answer: "",
      explanation: "",
      ...(isAI ? { after_scene: 0 } : { time: 0 }),
    }]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/40 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls + " flex-1 min-w-[12rem]"} />
        <select
          value={video.display_mode ?? "visual"}
          onChange={(e) => run(() => videosAPI.update(video.id, { display_mode: e.target.value }), t("video.editor.saved"))}
          disabled={saving}
          className={inputCls + " w-auto"}
          title={t("video.studio.displayMode")}
        >
          {(["visual", "both", "text"] as const).map((m) => (
            <option key={m} value={m}>{t(`video.studio.displayModes.${m}.name`)}</option>
          ))}
        </select>
        <button onClick={togglePublish} disabled={saving || !ready}
          className={video.is_published
            ? "px-3 py-1.5 rounded-lg text-sm border border-green-500 text-green-600"
            : "px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"}>
          {video.is_published ? `✓ ${t("video.editor.isPublished")}` : t("video.editor.publish")}
        </button>
        <button onClick={regenerate} disabled={saving || video.status === "processing"} className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 disabled:opacity-50">
          🔄 {t("video.editor.regenerate")}
        </button>
        <button onClick={remove} className="px-3 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">🗑 {t("video.editor.delete")}</button>
      </div>

      {ready && (
        <>
          <div className="flex gap-2 text-sm">
            <button onClick={() => setSection("questions")} className={section === "questions" ? "font-semibold text-blue-600" : "text-slate-500"}>
              ❓ {t("video.editor.questions")} ({items.length})
            </button>
            {video.source !== "upload" && (
              <button onClick={() => setSection("scenes")} className={section === "scenes" ? "font-semibold text-blue-600" : "text-slate-500"}>
                🖼 {t("video.editor.scenes")} ({scenes.length})
              </button>
            )}
          </div>

          {section === "questions" && (
            <div className="space-y-3">
              {items.map((q, i) => (
                <div key={q.id} className="bg-white dark:bg-slate-800 rounded-xl p-3 space-y-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap gap-2 items-center">
                    <select value={q.type} onChange={(e) => {
                      const type = e.target.value as Interaction["type"];
                      updateItem(i, type === "true_false"
                        ? { type, options: ["صح", "خطأ"], correct_answer: "صح" }
                        : { type, options: ["", "", "", ""], correct_answer: "" });
                    }} className={inputCls + " w-auto"}>
                      <option value="mcq">{t("video.editor.mcq")}</option>
                      <option value="true_false">{t("video.editor.trueFalse")}</option>
                    </select>
                    {isAI ? (
                      <label className="text-xs text-slate-500 flex items-center gap-1">
                        {t("video.editor.afterScene")}
                        <select value={q.after_scene ?? 0} onChange={(e) => updateItem(i, { after_scene: +e.target.value })} className={inputCls + " w-auto"}>
                          {scenes.map((s, k) => <option key={k} value={k}>{k + 1}. {s.title.slice(0, 30)}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label className="text-xs text-slate-500 flex items-center gap-1">
                        {t("video.editor.atSecond")}
                        <input type="number" min={0} step={1} value={q.time ?? ""} placeholder={t("video.editor.auto")}
                          onChange={(e) => updateItem(i, { time: e.target.value === "" ? null : +e.target.value })}
                          className={inputCls + " w-24"} />
                      </label>
                    )}
                    <button onClick={() => setItems((xs) => xs.filter((_, k) => k !== i))} className="ms-auto text-xs text-red-500">✕</button>
                  </div>
                  <input value={q.question} onChange={(e) => updateItem(i, { question: e.target.value })} placeholder={t("video.editor.questionText")} className={inputCls} />
                  <div className="grid sm:grid-cols-2 gap-2">
                    {q.options.map((opt, k) => (
                      <label key={k} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${q.id}`} checked={!!opt && opt === q.correct_answer}
                          onChange={() => updateItem(i, { correct_answer: opt })} title={t("video.editor.markCorrect")} />
                        <input value={opt} disabled={q.type === "true_false"}
                          onChange={(e) => {
                            const options = q.options.map((o, j) => (j === k ? e.target.value : o));
                            updateItem(i, { options, correct_answer: q.correct_answer === opt ? e.target.value : q.correct_answer });
                          }}
                          placeholder={t("video.editor.option", { n: k + 1 })} className={inputCls} />
                      </label>
                    ))}
                  </div>
                  <input value={q.explanation ?? ""} onChange={(e) => updateItem(i, { explanation: e.target.value })} placeholder={t("video.editor.explanation")} className={inputCls} />
                </div>
              ))}
              <button onClick={addItem} className="text-sm text-blue-600 hover:underline">+ {t("video.editor.addQuestion")}</button>
            </div>
          )}

          {section === "scenes" && (
            <div className="space-y-3">
              {scenes.map((s, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-3 space-y-2 border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-2 items-center">
                    <input value={s.visual ?? ""} onChange={(e) => updateScene(i, { visual: e.target.value })} className={inputCls + " w-14 text-center"} />
                    <input value={s.title} onChange={(e) => updateScene(i, { title: e.target.value })} className={inputCls} />
                    {s.visual_type && s.visual_type !== "bullets" && (
                      <select
                        value={s.visual_type}
                        onChange={(e) => e.target.value === "bullets" && updateScene(i, { visual_type: "bullets", visual_data: {} })}
                        className={inputCls + " w-auto"}
                        title={t("video.editor.visual")}
                      >
                        <option value={s.visual_type}>{t(`video.visuals.${s.visual_type}`)}</option>
                        <option value="bullets">{t("video.visuals.bullets")}</option>
                      </select>
                    )}
                    {!isAI && (
                      <input type="number" min={0} value={s.start ?? 0} onChange={(e) => updateScene(i, { start: +e.target.value })} className={inputCls + " w-24"} title={t("video.editor.startSecond")} />
                    )}
                  </div>
                  <textarea value={s.bullets.join("\n")} rows={3} onChange={(e) => updateScene(i, { bullets: e.target.value.split("\n") })}
                    placeholder={t("video.editor.bullets")} className={inputCls} />
                  {isAI && (
                    <textarea value={s.narration ?? ""} rows={3} onChange={(e) => updateScene(i, { narration: e.target.value })}
                      placeholder={t("video.editor.narration")} className={inputCls} />
                  )}
                </div>
              ))}
            </div>
          )}

          <button onClick={save} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-60">
            {saving ? t("video.editor.saving") : t("video.editor.save")}
          </button>
        </>
      )}
    </div>
  );
}

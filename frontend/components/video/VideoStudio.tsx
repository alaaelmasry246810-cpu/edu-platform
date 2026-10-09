"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { videosAPI, withDirectUpload } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Method = "ai" | "podcast" | "upload";

interface Props {
  curriculumId: string;
  lessonId: string;
  lessonTitle: string;
  unitId?: string;
  unitTitle?: string;
  onCreated: (video: any) => void;
  onClose: () => void;
}

const VOICES = ["nova", "shimmer", "alloy", "echo", "fable", "onyx"];

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, "0")}`;
}

export default function VideoStudio({ curriculumId, lessonId, lessonTitle, unitId, unitTitle, onCreated, onClose }: Props) {
  const { t } = useI18n();
  const [method, setMethod] = useState<Method>("ai");
  const [scope, setScope] = useState<"lesson" | "unit">("lesson");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  // AI
  const [voice, setVoice] = useState("nova");
  const [sceneCount, setSceneCount] = useState(6);
  const [scriptMode, setScriptMode] = useState<"lesson_text" | "explain">("lesson_text");
  const [displayMode, setDisplayMode] = useState<"visual" | "text" | "both">("both");
  const [sourceText, setSourceText] = useState("");

  // Podcast
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Upload
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [autoQuestions, setAutoQuestions] = useState(true);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((tr) => tr.stop());
  }, []);

  useEffect(() => () => { if (audioPreview) URL.revokeObjectURL(audioPreview); }, [audioPreview]);

  const scopeFields = () =>
    scope === "unit" && unitId
      ? { curriculum_id: curriculumId, unit_id: unitId }
      : { curriculum_id: curriculumId, lesson_id: lessonId };

  const setAudio = (blob: Blob | null) => {
    setAudioBlob(blob);
    setAudioPreview(blob ? URL.createObjectURL(blob) : "");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setAudio(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start(1000);
      recorderRef.current = rec;
      setAudio(null);
      setRecSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      toast.error(t("video.studio.micDenied"));
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const onProgress = (e: any) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100)); };

  const submit = async () => {
    setBusy(true);
    try {
      let data;
      if (method === "ai") {
        ({ data } = await videosAPI.createAI({ ...scopeFields(), title: title || undefined, voice, scene_count: sceneCount, script_mode: scriptMode, source_text: sourceText.trim() || undefined, display_mode: displayMode }));
      } else {
        const form = new FormData();
        Object.entries(scopeFields()).forEach(([k, v]) => form.append(k, v));
        form.append("title", title);
        form.append("display_mode", displayMode);
        if (sourceText.trim()) form.append("source_text", sourceText.trim());
        if (method === "podcast") {
          if (!audioBlob) { toast.error(t("video.studio.needAudio")); return; }
          const ext = audioBlob.type.includes("mp4") ? "m4a" : audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mpeg") ? "mp3" : "webm";
          const name = audioBlob instanceof File ? audioBlob.name : `podcast.${ext}`;
          form.append("file", audioBlob, name);
          setUploadPct(0);
          ({ data } = await videosAPI.createPodcast(await withDirectUpload(form, "podcast", { onUploadProgress: onProgress }), onProgress));
        } else {
          if (!videoFile) { toast.error(t("video.studio.needVideo")); return; }
          form.append("file", videoFile);
          form.append("auto_interactions", String(autoQuestions));
          setUploadPct(0);
          ({ data } = await videosAPI.upload(await withDirectUpload(form, "video", { onUploadProgress: onProgress }), onProgress));
        }
      }
      toast.success(t("video.studio.started"));
      onCreated(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("video.studio.error"));
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  const methods: { key: Method; icon: string }[] = [
    { key: "ai", icon: "🤖" },
    { key: "podcast", icon: "🎙️" },
    { key: "upload", icon: "📤" },
  ];

  const inputCls = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-800/60">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">✨ {t("video.studio.title")}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
      </div>

      {/* Method */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {methods.map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={clsx(
              "rounded-xl border-2 p-3 text-center transition-colors",
              method === m.key ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300",
            )}
          >
            <div className="text-2xl">{m.icon}</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">{t(`video.studio.methods.${m.key}.name`)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">{t(`video.studio.methods.${m.key}.desc`)}</div>
          </button>
        ))}
      </div>

      {/* Scope */}
      {unitId && (
        <div className="flex flex-wrap gap-2 mb-4 text-sm">
          <span className="text-slate-500 self-center">{t("video.studio.scope")}:</span>
          {(["lesson", "unit"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={clsx("px-3 py-1.5 rounded-full border", scope === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300")}
            >
              {s === "lesson" ? t("video.studio.scopeLesson", { title: lessonTitle }) : t("video.studio.scopeUnit", { title: unitTitle || "" })}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("video.studio.titlePlaceholder")} className={inputCls} />

        {/* What the student sees: scenes, the lesson text with the spoken sentence lit up, or both */}
        <div className="space-y-2">
          <p className="text-sm text-slate-600 dark:text-slate-300">{t("video.studio.displayMode")}</p>
          <div className="grid grid-cols-3 gap-2">
            {(["visual", "both", "text"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setDisplayMode(m)}
                className={clsx(
                  "text-start rounded-xl border-2 px-3 py-2",
                  displayMode === m ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700",
                )}
              >
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`video.studio.displayModes.${m}.name`)}</div>
                <div className="text-[11px] text-slate-500 hidden sm:block">{t(`video.studio.displayModes.${m}.desc`)}</div>
              </button>
            ))}
          </div>
          {method !== "ai" && displayMode !== "visual" && (
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={3}
              placeholder={t("video.studio.alignTextPlaceholder")}
              className={inputCls}
            />
          )}
        </div>

        {method === "ai" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-300">{t("video.studio.scriptSource")}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {(["lesson_text", "explain"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setScriptMode(m)}
                    className={clsx(
                      "text-start rounded-xl border-2 px-3 py-2",
                      scriptMode === m ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700",
                    )}
                  >
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t(`video.studio.scriptModes.${m}.name`)}</div>
                    <div className="text-[11px] text-slate-500">{t(`video.studio.scriptModes.${m}.desc`)}</div>
                  </button>
                ))}
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={3}
                placeholder={t("video.studio.sourceTextPlaceholder")}
                className={inputCls}
              />
            </div>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              {t("video.studio.voice")}
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className={clsx(inputCls, "mt-1")}>
                {VOICES.map((v) => <option key={v} value={v}>{t(`video.voices.${v}`)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              {t("video.studio.sceneCount", { n: sceneCount })}
              <input type="range" min={3} max={12} value={sceneCount} onChange={(e) => setSceneCount(+e.target.value)} className="w-full mt-3" />
            </label>
            <p className="sm:col-span-2 text-xs text-slate-500">{t("video.studio.aiHint")}</p>
          </div>
        )}

        {method === "podcast" && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {!recording ? (
                <button onClick={startRecording} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-white" /> {audioBlob ? t("video.studio.reRecord") : t("video.studio.record")}
                </button>
              ) : (
                <button onClick={stopRecording} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-full text-sm font-medium">
                  <span className="w-2.5 h-2.5 bg-red-500 animate-pulse rounded-sm" /> {t("video.studio.stop")} · {fmt(recSeconds)}
                </button>
              )}
              <span className="text-xs text-slate-400">{t("video.studio.or")}</span>
              <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                {t("video.studio.chooseAudio")}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {audioPreview && <audio src={audioPreview} controls className="w-full" />}
            <p className="text-xs text-slate-500">{t("video.studio.podcastHint")}</p>
          </div>
        )}

        {method === "upload" && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
            <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} className="text-sm" />
            {videoFile && <p className="text-xs text-slate-500">{videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={autoQuestions} onChange={(e) => setAutoQuestions(e.target.checked)} />
              {t("video.studio.autoQuestions")}
            </label>
            <p className="text-xs text-slate-500">{t("video.studio.uploadHint")}</p>
          </div>
        )}

        {uploadPct !== null && (
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || recording}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {busy ? (uploadPct !== null ? t("video.studio.uploading", { pct: uploadPct }) : t("video.studio.working")) : t(`video.studio.submit.${method}`)}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import SceneVisual, { hasVisual, type VisualType } from "./SceneVisual";

export interface Scene {
  title: string;
  bullets: string[];
  narration?: string;
  visual?: string;
  visual_type?: VisualType;
  visual_data?: any;
  start?: number;
  audio_url?: string;
}

export interface Interaction {
  id: string;
  type: "mcq" | "true_false";
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  time?: number | null;
  after_scene?: number;
}

export interface InteractiveVideoData {
  id: string;
  title: string;
  source: "ai" | "podcast" | "upload";
  media_url?: string | null;
  scenes: Scene[];
  interactions: Interaction[];
}

type Answers = Record<string, { choice: string; correct: boolean }>;

const SCENE_GRADIENTS = [
  "from-blue-600 to-indigo-700",
  "from-emerald-600 to-teal-700",
  "from-violet-600 to-purple-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-700",
  "from-cyan-600 to-sky-700",
];

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Interactions anchored to a time; untimed ones (time=null) are spread evenly over the duration. */
function timedInteractions(items: Interaction[], duration: number) {
  const untimed = items.filter((q) => q.time == null);
  return items
    .map((q) => {
      if (q.time != null) return { q, at: q.time };
      const k = untimed.indexOf(q);
      return { q, at: duration ? (duration * (k + 1)) / (untimed.length + 1) : Infinity };
    })
    .sort((a, b) => a.at - b.at);
}

export default function InteractivePlayer({ video }: { video: InteractiveVideoData }) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);

  const [answers, setAnswers] = useState<Answers>({});
  const [activeQ, setActiveQ] = useState<Interaction | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [captions, setCaptions] = useState(true);
  const resumeAfterQ = useRef(false);

  const isAI = video.source === "ai";
  const isUpload = video.source === "upload";
  const scenes = video.scenes ?? [];
  const interactions = video.interactions ?? [];

  const timeline = useMemo(
    () => (isAI ? [] : timedInteractions(interactions, duration)),
    [isAI, interactions, duration],
  );

  // Reset when switching to another video
  useEffect(() => {
    setAnswers({}); setActiveQ(null); setPicked(null); setPlaying(false);
    setCurrent(0); setDuration(0); setSceneIdx(0); setFinished(false);
  }, [video.id]);

  const media = () => mediaRef.current;

  const play = () => { media()?.play().catch(() => {}); };
  const pause = () => { media()?.pause(); };

  const openQuestion = (q: Interaction) => {
    resumeAfterQ.current = true;
    pause();
    setPicked(null);
    setActiveQ(q);
  };

  const pendingAfterScene = (idx: number, ans: Answers = answers) =>
    interactions.find((q) => q.after_scene === idx && !ans[q.id]);

  // ── Timed modes (podcast / upload): pause at each unanswered question ──
  const onTimeUpdate = () => {
    const m = media();
    if (!m) return;
    const now = m.currentTime;
    setCurrent(now);
    if (isAI) return;
    if (!activeQ) {
      // Seeking past a question doesn't skip it: jump back and ask.
      const due = timeline.find(({ q, at }) => at <= now && !answers[q.id]);
      if (due) {
        if (now - due.at > 1) m.currentTime = due.at;
        openQuestion(due.q);
      }
    }
    if (video.source === "podcast" && scenes.length) {
      let idx = 0;
      scenes.forEach((s, i) => { if ((s.start ?? 0) <= now) idx = i; });
      if (idx !== sceneIdx) setSceneIdx(idx);
    }
  };

  // ── AI mode: scene by scene, questions between scenes ──
  const goToScene = (idx: number) => {
    if (idx >= scenes.length) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    setSceneIdx(idx);
    setCurrent(0);
    resumeAfterQ.current = true;
  };

  const onEnded = () => {
    if (!isAI) {
      const left = timeline.find(({ q }) => !answers[q.id]);
      if (left) return openQuestion(left.q);
      setPlaying(false);
      setFinished(true);
      return;
    }
    const q = pendingAfterScene(sceneIdx);
    if (q) return openQuestion(q);
    goToScene(sceneIdx + 1);
  };

  // AI scene changed → load its narration and keep playing if we were.
  useEffect(() => {
    if (!isAI) return;
    const m = media();
    if (!m) return;
    m.load();
    if (resumeAfterQ.current) { resumeAfterQ.current = false; play(); }
  }, [sceneIdx, isAI]);

  const answer = (choice: string) => {
    if (!activeQ || picked) return;
    setPicked(choice);
    setAnswers((a) => ({ ...a, [activeQ.id]: { choice, correct: choice === activeQ.correct_answer } }));
  };

  const continueAfterQ = () => {
    const q = activeQ;
    setActiveQ(null);
    setPicked(null);
    if (!q) return;
    if (isAI) {
      const nextAns = { ...answers };
      const more = pendingAfterScene(sceneIdx, nextAns);
      if (more) return openQuestion(more);
      goToScene(sceneIdx + 1);
      return;
    }
    const m = media();
    if (m && m.ended) return onEnded();
    if (resumeAfterQ.current) { resumeAfterQ.current = false; play(); }
  };

  const restart = () => {
    setAnswers({}); setFinished(false); setActiveQ(null); setPicked(null);
    if (isAI) { setSceneIdx(0); resumeAfterQ.current = true; if (sceneIdx === 0) { media()?.load(); play(); } }
    else { const m = media(); if (m) { m.currentTime = 0; play(); } }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const m = media();
    if (!m || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    let frac = (e.clientX - rect.left) / rect.width;
    if (rtl) frac = 1 - frac;
    m.currentTime = Math.max(0, Math.min(duration, frac * duration));
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const scene = scenes[sceneIdx];
  const sceneFraction = (() => {
    if (isAI) return duration ? current / duration : 0;
    if (!scene) return 0;
    const start = scene.start ?? 0;
    const end = scenes[sceneIdx + 1]?.start ?? duration;
    return end > start ? (current - start) / (end - start) : 1;
  })();
  const visibleBullets = scene ? Math.max(1, Math.ceil(Math.min(1, sceneFraction * 1.3) * scene.bullets.length)) : 0;

  const total = interactions.length;
  const correctCount = Object.values(answers).filter((a) => a.correct).length;
  const progress = isAI
    ? (sceneIdx + (duration ? current / duration : 0)) / Math.max(1, scenes.length)
    : duration ? current / duration : 0;

  const mediaSrc = isAI ? mediaUrl(scene?.audio_url) : mediaUrl(video.media_url);

  return (
    <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden shadow-lg bg-slate-900 text-white select-none">
      {/* ── Stage ── */}
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        {isUpload ? (
          <video
            ref={mediaRef}
            src={mediaSrc}
            className="absolute inset-0 w-full h-full bg-black"
            controls={!activeQ}
            playsInline
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => { setPlaying(true); setFinished(false); }}
            onPause={() => setPlaying(false)}
            onEnded={onEnded}
          />
        ) : (
          <>
            <audio
              ref={mediaRef}
              src={mediaSrc || undefined}
              preload="auto"
              onTimeUpdate={onTimeUpdate}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => { setPlaying(true); setFinished(false); }}
              onPause={() => setPlaying(false)}
              onEnded={onEnded}
            />
            {scene ? (
              <div
                key={sceneIdx}
                className={clsx(
                  "absolute inset-0 bg-gradient-to-br flex flex-col justify-center px-[6%] py-[5%] animate-scene-in",
                  SCENE_GRADIENTS[sceneIdx % SCENE_GRADIENTS.length],
                )}
              >
                {hasVisual(scene.visual_type, scene.visual_data) ? (
                  /* Subject visual (equation / organ diagram / process / image) + the points beside it */
                  <div className="absolute inset-0 flex flex-col px-[4%] pt-[3%] pb-[9%]">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-[clamp(1.2rem,3vw,2rem)]">{scene.visual || "📘"}</span>
                      <h2 className="text-[clamp(.95rem,2.8vw,1.9rem)] font-bold leading-tight flex-1">{scene.title}</h2>
                      <span className="text-[10px] sm:text-xs opacity-60 whitespace-nowrap">{t("video.player.scene", { n: sceneIdx + 1, total: scenes.length })}</span>
                    </div>
                    <div className="flex-1 min-h-0 flex gap-[3%]">
                      <div className="flex-[3] min-w-0 min-h-0 flex items-center justify-center">
                        <SceneVisual type={scene.visual_type} data={scene.visual_data} p={sceneFraction} />
                      </div>
                      {scene.bullets.length > 0 && (
                        <ul className="flex-[2] min-w-0 space-y-1.5 self-center hidden sm:block">
                          {scene.bullets.map((b, i) => (
                            <li key={i} className={clsx("flex gap-2 text-[clamp(.7rem,1.6vw,1.05rem)] transition-all duration-500", i < visibleBullets ? "opacity-100" : "opacity-0")}>
                              <span className="opacity-70">•</span><span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                <div className="absolute top-4 end-5 text-[clamp(2.5rem,8vw,6rem)] opacity-90 drop-shadow-lg">{scene.visual || "📘"}</div>
                <p className="text-xs sm:text-sm opacity-70 mb-2">
                  {t("video.player.scene", { n: sceneIdx + 1, total: scenes.length })}
                </p>
                <h2 className="text-[clamp(1.1rem,3.6vw,2.4rem)] font-bold leading-tight mb-4 max-w-[80%]">{scene.title}</h2>
                <ul className="space-y-2 max-w-[85%]">
                  {scene.bullets.map((b, i) => (
                    <li
                      key={i}
                      className={clsx(
                        "flex gap-2 text-[clamp(.8rem,2.2vw,1.35rem)] transition-all duration-500",
                        i < visibleBullets ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
                      )}
                    >
                      <span className="opacity-70">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                  </>
                )}
                {isAI && captions && scene.narration && (
                  <div className="absolute bottom-3 inset-x-4 text-center">
                    <span className="inline-block bg-black/55 rounded-lg px-3 py-1.5 text-[clamp(.7rem,1.7vw,1rem)] leading-relaxed line-clamp-2">
                      {scene.narration}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
                <span className="text-7xl">🎙️</span>
              </div>
            )}

            {!playing && !activeQ && !finished && (
              <button
                onClick={play}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/90 hover:bg-white text-slate-900 flex items-center justify-center text-2xl shadow-xl"
                aria-label={t("video.player.play")}
              >
                ▶
              </button>
            )}
          </>
        )}

        {/* ── Question overlay ── */}
        {activeQ && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-10">
            <div className="w-full max-w-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl p-4 sm:p-6 shadow-2xl max-h-full overflow-y-auto">
              <p className="text-xs font-semibold text-blue-600 mb-1">❓ {t("video.player.quickQuestion")}</p>
              <h3 className="font-bold text-base sm:text-lg mb-4">{activeQ.question}</h3>
              <div className={clsx("grid gap-2", activeQ.type === "true_false" ? "grid-cols-2" : "sm:grid-cols-2")}>
                {activeQ.options.map((opt) => {
                  const isCorrect = opt === activeQ.correct_answer;
                  const isPicked = opt === picked;
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      disabled={!!picked}
                      className={clsx(
                        "text-start px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors",
                        !picked && "border-slate-200 dark:border-slate-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700",
                        picked && isCorrect && "border-green-500 bg-green-50 dark:bg-green-900/30",
                        picked && isPicked && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-900/30",
                        picked && !isPicked && !isCorrect && "border-slate-200 dark:border-slate-600 opacity-60",
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked && (
                <div className="mt-4">
                  <p className={clsx("font-semibold text-sm", picked === activeQ.correct_answer ? "text-green-600" : "text-red-500")}>
                    {picked === activeQ.correct_answer ? t("video.player.correct") : t("video.player.wrong", { answer: activeQ.correct_answer })}
                  </p>
                  {activeQ.explanation && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{activeQ.explanation}</p>}
                  <button onClick={continueAfterQ} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">
                    {t("video.player.continue")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── End screen ── */}
        {finished && !activeQ && (
          <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center gap-3 z-10 text-center p-4">
            <span className="text-5xl">🎉</span>
            <p className="text-lg font-bold">{t("video.player.done")}</p>
            {total > 0 && (
              <p className="text-sm opacity-80">{t("video.player.score", { correct: correctCount, total })}</p>
            )}
            <button onClick={restart} className="mt-2 bg-white text-slate-900 px-5 py-2 rounded-xl text-sm font-medium hover:bg-slate-100">
              🔁 {t("video.player.replay")}
            </button>
          </div>
        )}
      </div>

      {/* ── Controls (slides modes; uploaded video keeps native controls) ── */}
      {!isUpload && (
        <div className="px-3 py-2.5 bg-slate-950 flex items-center gap-3 text-sm">
          <button onClick={playing ? pause : play} disabled={!!activeQ} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-40">
            {playing ? "❚❚" : "▶"}
          </button>
          {isAI && (
            <>
              <button onClick={() => goToScene(Math.max(0, sceneIdx - 1))} disabled={!!activeQ || sceneIdx === 0} className="opacity-80 hover:opacity-100 disabled:opacity-30" aria-label={t("video.player.prev")}>⏮</button>
              <button
                onClick={() => { const q = pendingAfterScene(sceneIdx); q ? openQuestion(q) : goToScene(sceneIdx + 1); }}
                disabled={!!activeQ}
                className="opacity-80 hover:opacity-100 disabled:opacity-30"
                aria-label={t("video.player.next")}
              >⏭</button>
            </>
          )}
          <div className="flex-1 relative h-2 rounded-full bg-white/15 cursor-pointer" onClick={isAI ? undefined : seek}>
            <div className="absolute inset-y-0 start-0 rounded-full bg-blue-500" style={{ width: `${Math.min(100, progress * 100)}%` }} />
            {isAI
              ? scenes.slice(1).map((_, i) => (
                  <span key={i} className="absolute top-0 bottom-0 w-px bg-white/40" style={{ insetInlineStart: `${((i + 1) / scenes.length) * 100}%` }} />
                ))
              : duration > 0 && timeline.map(({ q, at }) => isFinite(at) && (
                  <span
                    key={q.id}
                    className={clsx("absolute -top-1 w-2 h-4 rounded-sm -translate-x-1/2 rtl:translate-x-1/2", answers[q.id] ? (answers[q.id].correct ? "bg-green-400" : "bg-red-400") : "bg-amber-400")}
                    style={{ insetInlineStart: `${(at / duration) * 100}%` }}
                    title={q.question}
                  />
                ))}
          </div>
          <span className="tabular-nums opacity-70 text-xs whitespace-nowrap">
            {isAI ? `${sceneIdx + 1}/${scenes.length}` : `${fmt(current)} / ${fmt(duration)}`}
          </span>
          {total > 0 && <span className="text-xs opacity-80 whitespace-nowrap">✅ {correctCount}/{total}</span>}
          {isAI && (
            <button onClick={() => setCaptions((c) => !c)} className={clsx("text-xs px-1.5 rounded border", captions ? "border-white/70" : "border-white/25 opacity-60")}>CC</button>
          )}
          <button onClick={toggleFullscreen} className="opacity-80 hover:opacity-100" aria-label={t("video.player.fullscreen")}>⛶</button>
        </div>
      )}

      {/* Question markers under native video controls */}
      {isUpload && total > 0 && (
        <div className="px-3 py-2 bg-slate-950 flex items-center gap-2 text-xs">
          <span className="opacity-70">{t("video.player.questionsInVideo", { n: total })}</span>
          <span className="ms-auto">✅ {correctCount}/{total}</span>
        </div>
      )}
    </div>
  );
}

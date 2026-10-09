"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { QRCodeSVG } from "qrcode.react";
import { liveAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { startMusic, sfx } from "@/components/activities/shared";

const COLORS = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];
const SHAPES = ["▲", "◆", "●", "■"];

/** The live game's main screen (projector): PIN & QR, questions, results, podium. */
export default function LiveHost() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useI18n();
  const router = useRouter();
  const [s, setS] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const stopMusic = useRef<() => void>(() => {});
  const revealSent = useRef(-1);

  // Poll the game state.
  useEffect(() => {
    let alive = true;
    const tick = () => liveAPI.hostState(id).then(({ data }) => alive && setS(data)).catch(() => {});
    tick();
    const iv = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [id]);

  // Music while waiting / answering.
  const status = s?.status;
  useEffect(() => {
    stopMusic.current();
    if (!muted && (status === "lobby" || status === "question")) stopMusic.current = startMusic(status === "question" ? 0.14 : 0.2);
    if (status === "ended") sfx.fanfare();
    return () => stopMusic.current();
  }, [status, muted]);

  // Reveal automatically when time is up or everyone has answered.
  useEffect(() => {
    if (!s || s.status !== "question" || revealSent.current === s.index) return;
    if (s.time_left <= 0 || (s.player_count > 0 && s.answered >= s.player_count)) {
      revealSent.current = s.index;
      act("reveal");
    }
  }, [s]);

  const act = async (action: string) => {
    setBusy(true);
    try { const { data } = await liveAPI.action(id, action); setS((x: any) => ({ ...x, ...data })); }
    finally { setBusy(false); }
  };

  if (!s) return <div className="fixed inset-0 bg-indigo-950" />;
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play?pin=${s.pin}` : "";
  const q = s.question;
  const maxDist = Math.max(1, ...(s.distribution ?? [0]));

  return (
    <div dir={dir} className="fixed inset-0 z-50 overflow-auto bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 text-white">
      <div className="flex items-center justify-between px-6 py-3">
        <span className="font-bold opacity-90">🎮 {s.title}</span>
        <div className="flex items-center gap-3 text-sm">
          {s.status !== "lobby" && <span className="bg-white/15 rounded-lg px-3 py-1">PIN <b className="font-mono tracking-widest">{s.pin}</b></span>}
          <span className="bg-white/15 rounded-lg px-3 py-1">👥 {s.player_count}</span>
          <button onClick={() => setMuted((m) => !m)} className="bg-white/15 rounded-lg px-3 py-1">{muted ? "🔇" : "🔊"}</button>
          <button onClick={() => { act("end"); router.push("/teacher/activities"); }} className="bg-white/15 rounded-lg px-3 py-1">✕</button>
        </div>
      </div>

      {/* Lobby */}
      {s.status === "lobby" && (
        <div className="max-w-5xl mx-auto px-6 py-6 text-center space-y-6">
          <div className="inline-flex flex-wrap items-center gap-6 bg-white text-slate-900 rounded-3xl px-8 py-5 shadow-2xl">
            <div className="text-start">
              <p className="text-sm text-slate-500">{t("games.live.joinAt")} <b dir="ltr">{typeof window !== "undefined" ? window.location.host : ""}/play</b></p>
              <p className="text-sm text-slate-500">{t("games.live.pin")}</p>
              <p className="text-6xl font-extrabold font-mono tracking-[.2em]" dir="ltr">{s.pin}</p>
            </div>
            {joinUrl && <QRCodeSVG value={joinUrl} size={130} />}
          </div>
          {s.players.length > 0 && <p className="text-xs opacity-60">{t("games.live.kick")}</p>}
          <div className="flex flex-wrap justify-center gap-2 min-h-[6rem]">
            {s.players.length === 0 ? <p className="opacity-70 animate-pulse">{t("games.live.waiting")}</p> : s.players.map((n: string) => (
              <button key={n} onClick={() => confirm(t("games.live.kickConfirm", { name: n })) && liveAPI.kick(id, n)}
                title={t("games.live.kick")} className="bg-white/15 hover:bg-red-500/60 rounded-xl px-4 py-2 font-bold animate-pop transition-colors">{n}</button>
            ))}
          </div>
          <button onClick={() => act("next")} disabled={busy || s.player_count === 0}
            className="px-10 py-4 rounded-2xl bg-white text-indigo-900 text-xl font-extrabold disabled:opacity-50 shadow-xl">
            ▶ {t("games.live.begin")}
          </button>
        </div>
      )}

      {/* Question / reveal */}
      {(s.status === "question" || s.status === "reveal") && q && (
        <div className="max-w-6xl mx-auto px-6 py-4 space-y-6">
          <div className="flex items-center justify-between text-sm opacity-80">
            <span>{t("games.live.questionOf", { n: s.index + 1, total: s.total })}</span>
            <span>{t("games.live.answered", { n: s.answered ?? 0, total: s.player_count })}</span>
          </div>
          <div className="bg-white text-slate-900 rounded-3xl p-8 text-center shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold">{q.q}</h2>
          </div>
          {s.status === "question" && (
            <div className="flex justify-center">
              <div className={clsx("w-24 h-24 rounded-full flex items-center justify-center text-4xl font-extrabold border-4",
                s.time_left <= 5 ? "border-red-400 text-red-300 animate-pulse" : "border-white/60")}>{Math.ceil(s.time_left)}</div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {q.options.map((o: string, k: number) => {
              const right = k === q.answer_index;
              return (
                <div key={k} className={clsx("relative rounded-2xl px-6 py-6 text-2xl font-bold flex items-center gap-4 overflow-hidden transition-all",
                  COLORS[k], s.status === "reveal" && !right && "opacity-35", s.status === "reveal" && right && "ring-8 ring-white/70 scale-[1.02]")}>
                  {s.status === "reveal" && (
                    <div className="absolute inset-y-0 start-0 bg-black/20 transition-all duration-700" style={{ width: `${((s.distribution?.[k] ?? 0) / maxDist) * 100}%` }} />
                  )}
                  <span className="relative text-3xl">{SHAPES[k]}</span>
                  <span className="relative flex-1">{o}</span>
                  {s.status === "reveal" && <span className="relative text-xl">{right ? "✔" : ""} {s.distribution?.[k] ?? 0}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-center gap-3">
            {s.status === "question" && <button onClick={() => { revealSent.current = s.index; act("reveal"); }} className="px-6 py-3 rounded-xl bg-white/15 font-bold">{t("games.live.skipTimer")}</button>}
            {s.status === "reveal" && <button onClick={() => act("leaderboard")} disabled={busy} className="px-8 py-3 rounded-xl bg-white text-indigo-900 font-extrabold">🏅 {t("games.live.leaderboard")}</button>}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {s.status === "leaderboard" && (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
          <h2 className="text-3xl font-extrabold text-center mb-4">🏅 {t("games.live.leaderboard")}</h2>
          {(s.leaderboard ?? []).slice(0, 5).map((p: any, k: number) => (
            <div key={p.nickname} className="flex items-center gap-4 bg-white/10 rounded-2xl px-5 py-3 animate-pop" style={{ animationDelay: `${k * 80}ms` }}>
              <span className="text-2xl font-extrabold w-8">{k + 1}</span>
              <span className="flex-1 text-xl font-bold">{p.nickname} {p.streak >= 3 && <span className="text-orange-300">🔥{p.streak}</span>}</span>
              <span className="text-2xl font-extrabold font-mono">{p.score}</span>
            </div>
          ))}
          <div className="text-center pt-4">
            <button onClick={() => act("next")} disabled={busy} className="px-10 py-4 rounded-2xl bg-white text-indigo-900 text-xl font-extrabold">
              {s.index + 1 >= s.total ? `🏆 ${t("games.live.finish")}` : `▶ ${t("games.live.nextQuestion")}`}
            </button>
          </div>
        </div>
      )}

      {/* Podium */}
      {s.status === "ended" && (
        <div className="max-w-4xl mx-auto px-6 py-8 text-center space-y-8">
          <h2 className="text-4xl font-extrabold">🏆 {t("games.live.podium")}</h2>
          <div className="flex items-end justify-center gap-4 h-72">
            {[1, 0, 2].map((rank) => {
              const p = s.leaderboard?.[rank];
              if (!p) return <div key={rank} className="w-40" />;
              const h = ["h-64", "h-48", "h-36"][rank];
              return (
                <div key={rank} className="w-40 flex flex-col items-center gap-2 animate-pop" style={{ animationDelay: `${(2 - rank) * 300}ms` }}>
                  <span className="text-4xl">{["🥇", "🥈", "🥉"][rank]}</span>
                  <span className="font-bold text-lg truncate max-w-full">{p.nickname}</span>
                  <div className={clsx("w-full rounded-t-2xl flex items-start justify-center pt-3 text-2xl font-extrabold", h, ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-400 text-orange-950"][rank])}>{p.score}</div>
                </div>
              );
            })}
          </div>
          <button onClick={() => router.push("/teacher/activities")} className="px-8 py-3 rounded-xl bg-white text-indigo-900 font-extrabold">{t("games.live.done")}</button>
        </div>
      )}
    </div>
  );
}

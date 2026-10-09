"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { liveAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { sfx } from "@/components/activities/shared";

const COLORS = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"];
const SHAPES = ["▲", "◆", "●", "■"];
const STORE_KEY = "live_player";

/** Join a live game with its PIN and answer from the phone. */
export default function Play() {
  const { t, dir } = useI18n();
  const { user } = useAuthStore();
  const [pin, setPin] = useState("");
  const [nickname, setNickname] = useState("");
  const [player, setPlayer] = useState<{ player_id: string; token: string; nickname: string } | null>(null);
  const [s, setS] = useState<any>(null);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const lastIndex = useRef(-1);
  const lastStatus = useRef("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pin");
    if (p) setPin(p);
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
      if (saved?.player_id) setPlayer(saved);
    } catch {}
  }, []);
  useEffect(() => { if (user?.full_name && !nickname) setNickname(user.full_name.split(" ")[0]); }, [user]);

  // Poll my state while in a game.
  useEffect(() => {
    if (!player) return;
    let alive = true;
    const tick = () => liveAPI.playerState(player.player_id, player.token)
      .then(({ data }) => {
        if (!alive) return;
        // Sound when the answer is revealed.
        if (data.status !== lastStatus.current && data.status === "reveal" && data.my_answer) data.my_answer.correct ? sfx.correct() : sfx.wrong();
        lastStatus.current = data.status; lastIndex.current = data.index;
        setS(data);
      })
      .catch((err) => { if (err.response?.status === 404) leave(); });
    tick();
    const iv = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(iv); };
  }, [player]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setJoining(true);
    try {
      const { data } = await liveAPI.join(pin.trim(), nickname.trim());
      sessionStorage.setItem(STORE_KEY, JSON.stringify(data));
      setPlayer(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || t("games.live.joinError"));
    } finally { setJoining(false); }
  };
  const leave = () => { sessionStorage.removeItem(STORE_KEY); setPlayer(null); setS(null); };

  const answer = async (choice: number) => {
    if (!player || !s || s.my_answer) return;
    setS((x: any) => ({ ...x, my_answer: { choice, pending: true } }));
    try {
      const { data } = await liveAPI.answer(player.player_id, player.token, s.index, choice);
      setS((x: any) => ({ ...x, my_answer: data }));
    } catch (err: any) {
      setS((x: any) => ({ ...x, my_answer: null }));
      setError(err.response?.data?.detail || "");
    }
  };

  const shell = (children: React.ReactNode) => (
    <div dir={dir} className="min-h-screen bg-gradient-to-br from-indigo-950 via-violet-900 to-fuchsia-900 text-white flex flex-col">
      {player && s && (
        <div className="flex items-center justify-between px-4 py-3 bg-black/20 text-sm">
          <span className="font-bold">{player.nickname}</span>
          <span>{s.rank ? `#${s.rank}` : ""} · ⭐ {s.score} {s.streak >= 2 && `🔥${s.streak}`}</span>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-5">{children}</div>
    </div>
  );

  // Join form
  if (!player) {
    return shell(
      <form onSubmit={join} className="w-full max-w-sm bg-white text-slate-900 rounded-3xl p-6 space-y-4 shadow-2xl">
        <p className="text-center text-4xl">🎮</p>
        <h1 className="text-center text-xl font-extrabold">{t("games.live.joinTitle")}</h1>
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder={t("games.live.pin")}
          className="w-full text-center text-3xl font-mono font-bold tracking-[.3em] border-2 border-slate-300 rounded-xl py-3 outline-none focus:border-violet-500" dir="ltr" />
        <input value={nickname} onChange={(e) => setNickname(e.target.value.slice(0, 30))} placeholder={t("games.live.nickname")}
          className="w-full text-center text-lg font-bold border-2 border-slate-300 rounded-xl py-3 outline-none focus:border-violet-500" />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <button disabled={joining || pin.length < 6 || !nickname.trim()} className="w-full py-3 rounded-xl bg-slate-900 text-white text-lg font-extrabold disabled:opacity-40">
          {joining ? "…" : t("games.live.enter")}
        </button>
      </form>,
    );
  }

  if (!s) return shell(<p className="animate-pulse">…</p>);

  if (s.status === "lobby") {
    return shell(
      <div className="text-center space-y-3">
        <p className="text-6xl animate-bounce">✅</p>
        <p className="text-2xl font-extrabold">{t("games.live.youreIn")}</p>
        <p className="opacity-80">{t("games.live.waitHost")}</p>
      </div>,
    );
  }

  if (s.status === "ended") {
    return shell(
      <div className="text-center space-y-4">
        <p className="text-6xl">{s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : "🎉"}</p>
        <p className="text-3xl font-extrabold">{t("games.live.yourRank", { n: s.rank ?? "-", total: s.player_count })}</p>
        <p className="text-xl">⭐ {s.score}</p>
        <button onClick={leave} className="mt-4 px-6 py-2 rounded-xl bg-white text-indigo-900 font-bold">{t("games.live.leave")}</button>
      </div>,
    );
  }

  const mine = s.my_answer;
  if (s.status === "question") {
    if (mine) {
      return shell(
        <div className="text-center space-y-3">
          <p className="text-5xl animate-pulse">⏳</p>
          <p className="text-xl font-bold">{t("games.live.answerSent")}</p>
        </div>,
      );
    }
    return shell(
      <div className="w-full max-w-lg space-y-4">
        <div className="flex justify-between text-sm opacity-80">
          <span>{s.index + 1}/{s.total}</span>
          <span className={clsx("font-bold", s.time_left <= 5 && "text-red-300")}>⏱ {Math.ceil(s.time_left)}</span>
        </div>
        <p className="text-center text-xl font-bold bg-white/10 rounded-2xl p-4">{s.question.q}</p>
        <div className="grid grid-cols-2 gap-3">
          {s.question.options.map((o: string, k: number) => (
            <button key={k} onClick={() => answer(k)}
              className={clsx("rounded-2xl min-h-[7rem] p-3 flex flex-col items-center justify-center gap-1 font-bold shadow-lg active:scale-95 transition-transform", COLORS[k])}>
              <span className="text-4xl">{SHAPES[k]}</span>
              <span className="text-sm leading-tight">{o}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-center text-sm text-red-300">{error}</p>}
      </div>,
    );
  }

  // reveal / leaderboard
  const right = mine?.correct;
  return shell(
    <div className="text-center space-y-3">
      <p className="text-7xl">{!mine ? "⌛" : right ? "🎉" : "😕"}</p>
      <p className="text-3xl font-extrabold">{!mine ? t("games.live.noAnswer") : right ? t("games.live.correct") : t("games.live.wrong")}</p>
      {right && <p className="text-xl">+{mine.points}</p>}
      {!right && s.question && <p className="opacity-80">{t("games.answerWas", { answer: s.question.options[s.answer_index] })}</p>}
      {s.rank && <p className="text-lg bg-white/15 rounded-xl px-4 py-2 inline-block">{t("games.live.youreRank", { n: s.rank })}</p>}
    </div>,
  );
}

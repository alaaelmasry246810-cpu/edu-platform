"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

export interface LeaderboardEntry {
  rank: number; name: string; guest: boolean; score: number; correct: number; total: number; pct: number; duration_sec: number; me: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export const fmtTime = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : `${Math.round(sec)}s`);

/** Ranked by share of correct answers, then the faster time, then points. */
export default function Leaderboard({ entries, me, limit = 20 }: { entries: LeaderboardEntry[]; me?: LeaderboardEntry | null; limit?: number }) {
  const { t } = useI18n();
  if (!entries.length) return <p className="text-center text-slate-500 text-sm py-4">{t("games.leaderboard.empty")}</p>;
  const shown = entries.slice(0, limit);
  const meOutside = me && !shown.some((e) => e.me);

  const row = (e: LeaderboardEntry) => (
    <div key={`${e.rank}-${e.name}`} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2",
      e.me ? "bg-blue-600 text-white" : e.rank <= 3 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-white dark:bg-slate-800")}>
      <span className="w-8 text-center font-extrabold">{MEDALS[e.rank - 1] ?? e.rank}</span>
      <span className="flex-1 min-w-0 truncate font-semibold">
        {e.name}{e.me && ` (${t("games.leaderboard.you")})`}
        {e.guest && !e.me && <span className="ms-1 text-[10px] opacity-60">{t("games.leaderboard.guest")}</span>}
      </span>
      <span className="font-extrabold tabular-nums w-12 text-end" title={`${e.correct}/${e.total}`}>{e.pct}%</span>
      <span className={clsx("text-xs tabular-nums w-12 text-end", e.me ? "opacity-90" : "text-slate-500")}>⏱ {fmtTime(e.duration_sec)}</span>
      <span className={clsx("text-xs tabular-nums w-14 text-end", e.me ? "opacity-90" : "text-slate-500")}>{e.score}</span>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 px-3 text-[11px] text-slate-400">
        <span className="w-8" /><span className="flex-1">{t("games.leaderboard.name")}</span>
        <span className="w-12 text-end">{t("games.leaderboard.correct")}</span><span className="w-12 text-end">{t("games.leaderboard.time")}</span><span className="w-14 text-end">{t("games.leaderboard.score")}</span>
      </div>
      {shown.map(row)}
      {meOutside && <><p className="text-center text-slate-400">⋯</p>{row(me!)}</>}
    </div>
  );
}

/** Fetches and shows a leaderboard; refetches when refreshKey changes (e.g. after a new result). */
export function LeaderboardPanel({ load, refreshKey, title }: { load: () => Promise<{ data: { entries: LeaderboardEntry[]; me: LeaderboardEntry | null; players: number } }>; refreshKey?: unknown; title?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<{ entries: LeaderboardEntry[]; me: LeaderboardEntry | null; players: number } | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    load().then(({ data }) => setData(data)).catch((err) => { if (err.response?.status === 403) setHidden(true); });
  }, [refreshKey]);
  if (hidden) return null;
  if (!data) return <div className="h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-slate-100">🏆 {title ?? t("games.leaderboard.title")}</h3>
        <span className="text-xs text-slate-500">{t("games.leaderboard.players", { n: data.players })}</span>
      </div>
      {data.me && <p className="text-sm text-blue-600 font-semibold">{t("games.leaderboard.yourRank", { n: data.me.rank, total: data.players })}</p>}
      <Leaderboard entries={data.entries} me={data.me} />
      <p className="text-[11px] text-slate-400">{t("games.leaderboard.rule")}</p>
    </div>
  );
}

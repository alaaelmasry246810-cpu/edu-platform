"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { studyAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import FlashcardDeck from "./FlashcardDeck";
import { MatchGame, SpellItGame } from "@/components/activities/templates/SimpleGames";
import { type GameResult } from "@/components/activities/shared";

interface Card { front: string; back: string; hint?: string; category?: string }
type Mode = "browse" | "learn" | "match" | "write";

/**
 * Quizlet-style study for a lesson's flashcards: browse, Learn (Leitner
 * spaced repetition — cards you miss come back now, known ones later),
 * a timed match game, and a write-the-answer test.
 */
export default function FlashcardStudy({ lessonId, cards, onReset, resetting }: { lessonId: string; cards: Card[]; onReset?: () => void; resetting?: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("browse");
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const items = useMemo(() => cards.map((c) => ({ q: c.front, a: c.back, hint: c.hint })), [cards]);

  const modes: { key: Mode; icon: string }[] = [
    { key: "browse", icon: "🃏" }, { key: "learn", icon: "🧠" }, { key: "match", icon: "🔗" }, { key: "write", icon: "⌨️" },
  ];
  const pick = (m: Mode) => { setMode(m); setResult(null); setRound((r) => r + 1); };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 justify-center flex-wrap">
        {modes.map((m) => (
          <button key={m.key} onClick={() => pick(m.key)}
            className={clsx("px-4 py-2 rounded-xl text-sm font-semibold border-2", mode === m.key ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
            {m.icon} {t(`games.study.${m.key}`)}
          </button>
        ))}
      </div>

      {mode === "browse" && <FlashcardDeck cards={cards} onReset={onReset} resetting={resetting} />}
      {mode === "learn" && <LearnMode key={round} lessonId={lessonId} cards={cards} />}
      {(mode === "match" || mode === "write") && (result ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-5xl">🎉</p>
          <p className="text-xl font-bold">{t("games.result.correct", { correct: result.correct, total: result.total, pct: Math.round((100 * result.correct) / Math.max(1, result.total)) })}</p>
          <button onClick={() => pick(mode)} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold">🔁 {t("games.playAgain")}</button>
        </div>
      ) : (
        <div key={round} className="max-w-3xl mx-auto">
          {mode === "match" ? <MatchGame items={items} onFinish={setResult} /> : <SpellItGame items={items} onFinish={setResult} />}
        </div>
      ))}
    </div>
  );
}

function LearnMode({ lessonId, cards }: { lessonId: string; cards: Card[] }) {
  const { t } = useI18n();
  const [boxes, setBoxes] = useState<Record<number, { box: number; due: boolean; due_at: string }>>({});
  const [queue, setQueue] = useState<number[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    studyAPI.progress(lessonId).then(({ data }) => {
      const map: typeof boxes = {};
      data.cards.forEach((c: any) => { map[c.card_index] = c; });
      setBoxes(map);
      // Due now: never studied, or its review time has come — weakest boxes first.
      setQueue(cards.map((_, i) => i).filter((i) => !map[i] || map[i].due).sort((a, b) => (map[a]?.box ?? 0) - (map[b]?.box ?? 0)));
    }).catch(() => setQueue(cards.map((_, i) => i)));
  }, [lessonId, cards]);

  const answer = async (known: boolean) => {
    if (!queue?.length || saving) return;
    const i = queue[0];
    setSaving(true);
    try {
      const { data } = await studyAPI.review(lessonId, i, known);
      setBoxes((b) => ({ ...b, [i]: { box: data.box, due: !known, due_at: data.due_at } }));
      // Missed cards come back a few cards later in this session.
      setQueue((q) => {
        const rest = q!.slice(1);
        if (!known) rest.splice(Math.min(3, rest.length), 0, i);
        return rest;
      });
      setFlipped(false);
    } finally { setSaving(false); }
  };

  if (!queue) return <div className="h-48 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;
  const counts = [1, 2, 3, 4, 5].map((b) => cards.filter((_, i) => (boxes[i]?.box ?? 0) === b).length);
  const fresh = cards.filter((_, i) => !boxes[i]).length;
  const mastered = counts[4];
  const nextDue = Object.values(boxes).filter((b) => !b.due).map((b) => new Date(b.due_at)).sort((a, b) => +a - +b)[0];

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Leitner boxes */}
      <div className="grid grid-cols-6 gap-1 text-center text-[11px]">
        <Box label={t("games.study.new")} n={fresh} color="bg-slate-400" />
        {counts.map((n, k) => <Box key={k} label={k === 4 ? t("games.study.mastered") : t("games.study.box", { n: k + 1 })} n={n} color={["bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-500", "bg-green-500"][k]} />)}
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${(mastered / Math.max(1, cards.length)) * 100}%` }} />
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <p className="text-5xl">🌟</p>
          <p className="font-bold text-slate-700 dark:text-slate-200">{t("games.study.doneToday")}</p>
          {nextDue && <p className="text-sm text-slate-500">{t("games.study.nextReview", { date: nextDue.toLocaleDateString() })}</p>}
        </div>
      ) : (
        <>
          <p className="text-center text-xs text-slate-400">{t("games.study.left", { n: queue.length })}</p>
          <button onClick={() => setFlipped((f) => !f)} className="w-full" style={{ perspective: 1000 }}>
            <div className="relative h-56 transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
              <div className="absolute inset-0 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-6" style={{ backfaceVisibility: "hidden" }}>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{cards[queue[0]].front}</p>
                <p className="text-xs text-slate-400 mt-3">{t("games.flip")}</p>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center p-6" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                <p className="text-lg font-semibold">{cards[queue[0]].back}</p>
              </div>
            </div>
          </button>
          <div className={clsx("grid grid-cols-2 gap-3 transition-opacity", flipped ? "opacity-100" : "opacity-40 pointer-events-none")}>
            <button onClick={() => answer(false)} disabled={saving} className="rounded-xl py-3 border-2 border-amber-400 text-amber-700 dark:text-amber-300 font-bold">🔁 {t("games.stillLearning")}</button>
            <button onClick={() => answer(true)} disabled={saving} className="rounded-xl py-3 bg-emerald-500 text-white font-bold">✓ {t("games.iKnow")}</button>
          </div>
        </>
      )}
    </div>
  );
}

function Box({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5">
      <div className={clsx("mx-auto w-7 h-7 rounded-md text-white font-bold flex items-center justify-center text-sm", color)}>{n}</div>
      <div className="mt-1 text-slate-500 leading-tight">{label}</div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { type TemplateProps, type Answer, optionsFor, shuffle, sfx, useCountdown } from "../shared";

function Clock({ left }: { left: number | null }) {
  if (left === null) return null;
  return <span className={clsx("font-mono font-bold", left <= 10 && "text-red-500 animate-pulse")}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
}

/** Endless shuffled stream of item indexes. */
function useStream(n: number) {
  const queue = useRef<number[]>([]);
  return () => {
    if (!queue.current.length) queue.current = shuffle([...Array(n).keys()]);
    return queue.current.pop()!;
  };
}

// ── Whack-a-mole (Wordwall arcade): hit the mole holding the right answer ──

export function WhackGame(props: TemplateProps) {
  const { t } = useI18n();
  const { items, calm } = props;
  const next = useStream(items.length);
  const [idx, setIdx] = useState(() => next());
  const options = useMemo(() => optionsFor(items, idx), [idx, items]);
  const [moles, setMoles] = useState<(string | null)[]>(Array(6).fill(null));
  const [score, setScore] = useState(0);
  const [hit, setHit] = useState<{ hole: number; ok: boolean } | null>(null);
  const answers = useRef<Answer[]>([]);
  const qStart = useRef(Date.now());
  const started = useRef(Date.now());
  const done = useRef(false);

  const end = () => {
    if (done.current) return;
    done.current = true;
    const a = answers.current;
    props.onFinish({ score, correct: a.filter((x) => x.correct).length, total: a.length, answers: a, duration_sec: (Date.now() - started.current) / 1000 });
  };
  const left = useCountdown(props.gameSeconds ?? 90, end);

  const newQuestion = (correct: boolean | null, choice = "") => {
    if (correct !== null) answers.current.push({ i: idx, correct, choice, ms: Date.now() - qStart.current });
    setIdx(next()); setMoles(Array(6).fill(null)); qStart.current = Date.now();
  };

  // Moles pop up every ~0.9s; the right answer shows up at least every few pops.
  useEffect(() => {
    let pops = 0;
    const id = setInterval(() => {
      if (Date.now() - qStart.current > 9000) { sfx.wrong(); newQuestion(false); return; }
      pops++;
      setMoles((m) => {
        const free = m.map((v, k) => (v ? -1 : k)).filter((k) => k >= 0);
        const out = m.map((v) => (v && Math.random() < 0.45 ? null : v));
        if (free.length) {
          const hole = free[Math.floor(Math.random() * free.length)];
          const needRight = pops % 3 === 0 && !out.includes(items[idx].a);
          out[hole] = needRight ? items[idx].a : options[Math.floor(Math.random() * options.length)];
        }
        return out;
      });
    }, 900);
    return () => clearInterval(id);
  }, [idx, options]);

  const whack = (hole: number) => {
    const v = moles[hole];
    if (!v) return;
    const ok = v === items[idx].a;
    setHit({ hole, ok });
    setTimeout(() => setHit(null), 300);
    if (ok) { sfx.correct(); setScore((s) => s + 100); newQuestion(true, v); }
    else { sfx.wrong(); setScore((s) => Math.max(0, s - 30)); setMoles((m) => m.map((x, k) => (k === hole ? null : x))); answers.current.push({ i: idx, correct: false, choice: v }); }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-b from-sky-200 to-lime-200 dark:from-sky-900/40 dark:to-lime-900/30 p-5 space-y-4">
      <div className="flex justify-between items-center text-slate-800 dark:text-slate-100">
        <Clock left={left} />
        <span className="font-extrabold text-lg">⭐ {score}</span>
      </div>
      <p className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 bg-white/70 dark:bg-slate-900/50 rounded-2xl py-3 px-4">{items[idx].q}</p>
      <p className="text-center text-xs text-slate-600 dark:text-slate-300">{t("games.whack.howTo")}</p>
      <div className="grid grid-cols-3 gap-4">
        {moles.map((v, k) => (
          <button key={k} onClick={() => whack(k)}
            className={clsx("relative h-24 sm:h-28 rounded-[50%] bg-amber-900/80 overflow-hidden flex items-end justify-center",
              hit?.hole === k && (hit.ok ? "ring-4 ring-green-400" : "ring-4 ring-red-400"))}>
            <div className={clsx("absolute inset-x-2 bottom-0 rounded-t-full bg-amber-500 flex flex-col items-center justify-start pt-2 text-white font-bold text-sm px-1 text-center leading-tight",
              calm ? "transition-none" : "transition-transform duration-200", v ? "translate-y-0 h-[85%]" : "translate-y-full h-[85%]")}>
              <span className="text-2xl">{calm ? "●" : "🐹"}</span>
              <span className="mt-0.5 line-clamp-2">{v}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Tower builder (Blooket-style): right answers stack blocks, wrong ones knock one off ──

const BLOCK_COLORS = ["bg-rose-500", "bg-orange-500", "bg-amber-400", "bg-lime-500", "bg-emerald-500", "bg-cyan-500", "bg-blue-500", "bg-violet-500", "bg-fuchsia-500"];

export function TowerGame(props: TemplateProps) {
  const { t } = useI18n();
  const { items, calm } = props;
  const next = useStream(items.length);
  const [idx, setIdx] = useState(() => next());
  const options = useMemo(() => optionsFor(items, idx), [idx, items]);
  const [height, setHeight] = useState(0);
  const [best, setBest] = useState(0);
  const [flash, setFlash] = useState<null | boolean>(null);
  const answers = useRef<Answer[]>([]);
  const started = useRef(Date.now());
  const done = useRef(false);
  const GOAL = 12;

  const end = (h = height) => {
    if (done.current) return;
    done.current = true;
    const a = answers.current;
    props.onFinish({ score: Math.max(best, h) * 100, correct: a.filter((x) => x.correct).length, total: a.length, answers: a, duration_sec: (Date.now() - started.current) / 1000 });
  };
  const left = useCountdown(props.gameSeconds ?? 120, () => end());

  const answer = (opt: string) => {
    if (flash !== null) return;
    const ok = opt === items[idx].a;
    answers.current.push({ i: idx, correct: ok, choice: opt });
    const h = ok ? height + 1 : Math.max(0, height - 1);
    ok ? sfx.coin() : sfx.wrong();
    setHeight(h); setBest((b) => Math.max(b, h)); setFlash(ok);
    setTimeout(() => {
      setFlash(null);
      if (h >= GOAL) { sfx.fanfare(); end(h); } else setIdx(next());
    }, ok ? 450 : 900);
  };

  return (
    <div className="grid sm:grid-cols-[1fr,12rem] gap-5 items-end">
      <div className="space-y-4 order-2 sm:order-1">
        <div className="flex justify-between items-center text-sm">
          <Clock left={left} />
          <span className="font-bold text-slate-700 dark:text-slate-200">{t("games.tower.height", { n: height, goal: GOAL })}</span>
        </div>
        <p className={clsx("text-center text-xl font-bold rounded-2xl py-4 px-3 border-4 transition-colors",
          flash === true ? "border-green-500" : flash === false ? "border-red-500" : "border-transparent", "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100")}>
          {items[idx].q}
        </p>
        {flash === false && <p className="text-center text-sm text-slate-500">{t("games.answerWas", { answer: items[idx].a })}</p>}
        <div className="grid grid-cols-2 gap-3">
          {options.map((o, k) => (
            <button key={o} onClick={() => answer(o)} className={clsx("rounded-2xl py-4 px-3 text-white font-bold shadow", ["bg-sky-600", "bg-fuchsia-600", "bg-lime-700", "bg-orange-600"][k % 4])}>{o}</button>
          ))}
        </div>
      </div>
      {/* The tower */}
      <div className="order-1 sm:order-2 relative h-72 rounded-2xl bg-gradient-to-b from-sky-200 to-sky-50 dark:from-sky-900/40 dark:to-slate-900 overflow-hidden flex flex-col-reverse items-center pb-3">
        <div className="absolute bottom-0 inset-x-0 h-3 bg-emerald-600" />
        <div className="absolute inset-x-0 border-t-2 border-dashed border-amber-500" style={{ bottom: `${12 + GOAL * 19}px` }}>
          <span className="absolute -top-5 end-1 text-xs">🏁</span>
        </div>
        {[...Array(height)].map((_, k) => (
          <div key={k} className={clsx("w-24 h-[18px] mb-px rounded-sm shadow-sm relative z-10", BLOCK_COLORS[k % BLOCK_COLORS.length], !calm && k === height - 1 && "animate-pop")} />
        ))}
        {height > 0 && <span className="relative z-10 text-2xl -mb-1">{calm ? "▲" : "🚩"}</span>}
      </div>
    </div>
  );
}

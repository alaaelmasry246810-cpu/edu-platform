"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { type TemplateProps, type Answer, shuffle, sfx, wordItems, normalize } from "../shared";

const finish = (props: TemplateProps, answers: Answer[], score: number, started: number, total?: number) =>
  props.onFinish({
    score, correct: answers.filter((a) => a.correct).length, total: total ?? answers.length,
    answers, duration_sec: (Date.now() - started) / 1000,
  });

function Bar({ pos, total, score, extra }: { pos: number; total: number; score: number; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm mb-4">
      <span className="font-mono text-slate-500">{Math.min(pos + 1, total)}/{total}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${(pos / Math.max(1, total)) * 100}%` }} />
      </div>
      {extra}
      <span className="font-bold text-amber-600">⭐ {score}</span>
    </div>
  );
}

// ── True / False speed round ─────────────────────────────────

export function TrueFalseGame(props: TemplateProps) {
  const { t } = useI18n();
  const { items } = props;
  const LIMIT = 6;
  const rounds = useMemo(() => shuffle(items.map((it, i) => {
    const others = items.filter((x) => x.a !== it.a);
    const truth = others.length === 0 || Math.random() < 0.5;
    return { i, q: it.q, shown: truth ? it.a : others[Math.floor(Math.random() * others.length)].a, truth };
  })), [items]);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [flash, setFlash] = useState<null | boolean>(null);
  const [left, setLeft] = useState(LIMIT);
  const started = useRef(Date.now());
  const r = rounds[pos];

  useEffect(() => {
    if (!r || flash !== null) return;
    if (left <= 0) { pick(null); return; }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left, flash, pos]);

  const pick = (v: boolean | null) => {
    if (flash !== null || !r) return;
    const ok = v === r.truth;
    ok ? sfx.correct() : sfx.wrong();
    const pts = ok ? 100 + left * 20 : 0;
    const nextAnswers = [...answers, { i: r.i, correct: ok, choice: v === null ? "" : v ? "✓" : "✗" }];
    setAnswers(nextAnswers); setScore((s) => s + pts); setFlash(ok);
    setTimeout(() => {
      setFlash(null); setLeft(LIMIT);
      if (pos + 1 >= rounds.length) finish(props, nextAnswers, score + pts, started.current, rounds.length);
      else setPos((p) => p + 1);
    }, 900);
  };

  if (!r) return null;
  return (
    <div>
      <Bar pos={pos} total={rounds.length} score={score} extra={<span className={clsx("font-bold w-6", left <= 2 && "text-red-500")}>{left}</span>} />
      <div className={clsx("rounded-2xl p-8 text-center border-4 transition-colors",
        flash === true ? "border-green-500 bg-green-50 dark:bg-green-900/20" : flash === false ? "border-red-500 bg-red-50 dark:bg-red-900/20" : "border-transparent bg-white dark:bg-slate-800")}>
        <p className="text-lg text-slate-500 mb-2">{r.q}</p>
        <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{r.shown}</p>
        {flash === false && <p className="mt-3 text-sm text-slate-500">{t("games.answerWas", { answer: items[r.i].a })}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={() => pick(true)} className="rounded-2xl py-5 bg-emerald-500 hover:bg-emerald-600 text-white text-2xl font-bold">✓ {t("games.true")}</button>
        <button onClick={() => pick(false)} className="rounded-2xl py-5 bg-rose-500 hover:bg-rose-600 text-white text-2xl font-bold">✗ {t("games.false")}</button>
      </div>
    </div>
  );
}

// ── Match up ─────────────────────────────────────────────────

export function MatchGame(props: TemplateProps) {
  const { t } = useI18n();
  const { items } = props;
  const PER_ROUND = 6;
  const rounds = useMemo(() => {
    const idx = shuffle(items.map((_, i) => i));
    const out: number[][] = [];
    for (let k = 0; k < idx.length; k += PER_ROUND) out.push(idx.slice(k, k + PER_ROUND));
    return out;
  }, [items]);
  const [round, setRound] = useState(0);
  const [right, setRight] = useState<number[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());
  const cur = rounds[round] ?? [];
  const answersCol = useMemo(() => shuffle(cur), [round, rounds]);

  useEffect(() => { const id = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000); return () => clearInterval(id); }, []);

  const pickAnswer = (j: number) => {
    if (sel === null || right.includes(j)) return;
    if (j === sel) {
      sfx.correct();
      const done = [...right, j];
      setRight(done); setSel(null);
      if (cur.every((i) => done.includes(i))) {
        setTimeout(() => {
          if (round + 1 >= rounds.length) {
            const answers = items.map((_, i) => ({ i, correct: !mistakes[i] }));
            const score = Math.max(0, items.length * 100 - Object.values(mistakes).reduce((n, m) => n + m, 0) * 25 - Math.floor((Date.now() - started.current) / 1000));
            finish(props, answers, score, started.current, items.length);
          } else { setRound((r) => r + 1); setRight([]); }
        }, 500);
      }
    } else {
      sfx.wrong();
      setMistakes((m) => ({ ...m, [sel]: (m[sel] ?? 0) + 1 }));
      setWrongPair([sel, j]);
      setTimeout(() => setWrongPair(null), 600);
      setSel(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-4 text-slate-500">
        <span>{t("games.match.round", { n: round + 1, total: rounds.length })}</span>
        <span className="font-mono">⏱ {elapsed}s · ❌ {Object.values(mistakes).reduce((n, m) => n + m, 0)}</span>
      </div>
      <p className="text-xs text-slate-400 mb-3 text-center">{t("games.match.howTo")}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {cur.map((i) => (
            <button key={i} onClick={() => !right.includes(i) && setSel(i)} disabled={right.includes(i)}
              className={clsx("w-full text-start rounded-xl px-3 py-3 border-2 text-sm font-medium transition-all min-h-[3.5rem]",
                right.includes(i) ? "border-green-400 bg-green-50 dark:bg-green-900/20 opacity-50" :
                wrongPair?.[0] === i ? "border-red-500 animate-shake" :
                sel === i ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}>
              {items[i].q}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {answersCol.map((j) => (
            <button key={j} onClick={() => pickAnswer(j)} disabled={right.includes(j)}
              className={clsx("w-full text-start rounded-xl px-3 py-3 border-2 text-sm font-bold transition-all min-h-[3.5rem]",
                right.includes(j) ? "border-green-400 bg-green-50 dark:bg-green-900/20 opacity-50" :
                wrongPair?.[1] === j ? "border-red-500" : "border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 hover:border-violet-400")}>
              {items[j].a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Flip cards (know / still learning) ───────────────────────

export function FlashcardsGame(props: TemplateProps) {
  const { t } = useI18n();
  const order = useMemo(() => shuffle(props.items.map((_, i) => i)), [props.items]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const started = useRef(Date.now());
  const it = props.items[order[pos]];

  const mark = (known: boolean) => {
    const next = [...answers, { i: order[pos], correct: known }];
    setAnswers(next); setFlipped(false);
    if (pos + 1 >= order.length) finish(props, next, next.filter((a) => a.correct).length * 100, started.current, order.length);
    else setPos((p) => p + 1);
  };
  if (!it) return null;
  return (
    <div>
      <Bar pos={pos} total={order.length} score={answers.filter((a) => a.correct).length * 100} />
      <button onClick={() => setFlipped((f) => !f)} className="w-full" style={{ perspective: 1000 }}>
        <div className="relative h-60 transition-transform duration-500" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
          <div className="absolute inset-0 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-6" style={{ backfaceVisibility: "hidden" }}>
            <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{it.q}</p>
            <p className="text-xs text-slate-400 mt-4">{t("games.flip")}</p>
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center p-6" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <p className="text-2xl font-extrabold">{it.a}</p>
          </div>
        </div>
      </button>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button onClick={() => mark(false)} className="rounded-xl py-3 border-2 border-amber-400 text-amber-700 dark:text-amber-300 font-bold">🔁 {t("games.stillLearning")}</button>
        <button onClick={() => mark(true)} className="rounded-xl py-3 bg-emerald-500 text-white font-bold">✓ {t("games.iKnow")}</button>
      </div>
    </div>
  );
}

// ── Anagram (unscramble the answer) ──────────────────────────

export function AnagramGame(props: TemplateProps) {
  const { t } = useI18n();
  const words = useMemo(() => shuffle(wordItems(props.items)), [props.items]);
  const [pos, setPos] = useState(0);
  const [tiles, setTiles] = useState<{ ch: string; id: number }[]>([]);
  const [built, setBuilt] = useState<{ ch: string; id: number }[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState(0);
  const [state, setState] = useState<null | boolean>(null);
  const started = useRef(Date.now());
  const w = words[pos];

  useEffect(() => {
    if (!w) return;
    let letters = [...w.word].map((ch, id) => ({ ch, id }));
    for (let k = 0; k < 5 && letters.map((l) => l.ch).join("") === w.word; k++) letters = shuffle(letters);
    setTiles(letters); setBuilt([]); setState(null);
  }, [pos, w]);

  const advance = (ok: boolean, pts: number) => {
    const next = [...answers, { i: w.i, correct: ok, choice: built.map((b) => b.ch).join("") }];
    setAnswers(next); setScore((s) => s + pts); setState(ok);
    ok ? sfx.correct() : sfx.wrong();
    setTimeout(() => {
      if (pos + 1 >= words.length) finish(props, next, score + pts, started.current, words.length);
      else setPos((p) => p + 1);
    }, ok ? 800 : 1500);
  };

  const add = (tile: { ch: string; id: number }) => {
    if (state !== null) return;
    const nb = [...built, tile];
    setBuilt(nb); setTiles((ts) => ts.filter((x) => x.id !== tile.id));
    if (nb.length === w.word.length) {
      const ok = normalize(nb.map((b) => b.ch).join("")) === normalize(w.word);
      if (ok) advance(true, 100 + w.word.length * 10);
      else setTimeout(() => { setTiles((ts) => [...ts, ...nb]); setBuilt([]); sfx.wrong(); }, 500);
    }
  };

  if (!words.length) return <p className="text-center text-slate-500 py-10">{t("games.needWords")}</p>;
  if (!w) return null;
  return (
    <div>
      <Bar pos={pos} total={words.length} score={score} />
      <p className="text-center text-lg font-semibold text-slate-700 dark:text-slate-200 mb-6">{w.q}</p>
      <div className="flex justify-center gap-2 min-h-[3.5rem] mb-6 flex-wrap">
        {[...Array(w.word.length)].map((_, k) => (
          <button key={k} onClick={() => built[k] && state === null && (setTiles((ts) => [...ts, built[k]]), setBuilt((b) => b.filter((_, j) => j !== k)))}
            className={clsx("w-12 h-14 rounded-xl border-2 text-2xl font-bold flex items-center justify-center",
              state === true ? "border-green-500 bg-green-50 dark:bg-green-900/20" : state === false ? "border-red-400" : "border-blue-300 bg-white dark:bg-slate-800")}>
            {built[k]?.ch ?? ""}
          </button>
        ))}
      </div>
      {state === false && <p className="text-center text-sm text-slate-500 mb-3">{t("games.answerWas", { answer: w.word })}</p>}
      <div className="flex justify-center gap-2 flex-wrap">
        {tiles.map((tile) => (
          <button key={tile.id} onClick={() => add(tile)} className="w-12 h-14 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-2xl font-bold shadow">{tile.ch}</button>
        ))}
      </div>
      <div className="text-center mt-6">
        <button onClick={() => state === null && advance(false, 0)} className="text-sm text-slate-500 hover:underline">{t("games.skip")}</button>
      </div>
    </div>
  );
}

// ── Spell it (type the answer) ───────────────────────────────

export function SpellItGame(props: TemplateProps) {
  const { t } = useI18n();
  const order = useMemo(() => shuffle(props.items.map((_, i) => i)), [props.items]);
  const [pos, setPos] = useState(0);
  const [value, setValue] = useState("");
  const [hint, setHint] = useState(false);
  const [state, setState] = useState<null | boolean>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState(0);
  const started = useRef(Date.now());
  const it = props.items[order[pos]];

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (state !== null || !it) return;
    const ok = normalize(value) === normalize(it.a);
    const pts = ok ? (hint ? 50 : 100) : 0;
    ok ? sfx.correct() : sfx.wrong();
    const next = [...answers, { i: order[pos], correct: ok, choice: value }];
    setAnswers(next); setScore((s) => s + pts); setState(ok);
    setTimeout(() => {
      setValue(""); setHint(false); setState(null);
      if (pos + 1 >= order.length) finish(props, next, score + pts, started.current, order.length);
      else setPos((p) => p + 1);
    }, ok ? 700 : 1600);
  };
  if (!it) return null;
  return (
    <form onSubmit={submit}>
      <Bar pos={pos} total={order.length} score={score} />
      <p className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-5">{it.q}</p>
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} disabled={state !== null}
        className={clsx("w-full text-center text-2xl font-bold rounded-2xl border-4 px-4 py-3 bg-white dark:bg-slate-800 outline-none",
          state === true ? "border-green-500" : state === false ? "border-red-500" : "border-slate-200 dark:border-slate-700 focus:border-blue-500")}
        placeholder={hint ? `${it.a[0]}${"_ ".repeat(Math.max(0, it.a.length - 1))}` : t("games.typeAnswer")} />
      {state === false && <p className="text-center text-sm text-slate-500 mt-2">{t("games.answerWas", { answer: it.a })}</p>}
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={() => setHint(true)} disabled={hint || state !== null} className="px-4 py-3 rounded-xl border-2 border-amber-300 text-amber-700 disabled:opacity-40">💡 {t("games.hint")}</button>
        <button type="submit" className="flex-1 rounded-xl py-3 bg-blue-600 text-white font-bold">{t("games.check")}</button>
      </div>
    </form>
  );
}

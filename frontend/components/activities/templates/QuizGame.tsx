"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { type TemplateProps, type Answer, optionsFor, shuffle, sfx, speak } from "../shared";

const OPTION_STYLES = [
  "bg-rose-500 hover:bg-rose-600", "bg-blue-500 hover:bg-blue-600",
  "bg-amber-500 hover:bg-amber-600", "bg-emerald-500 hover:bg-emerald-600",
];
const SHAPES = ["▲", "◆", "●", "■"];

// Encouraging reactions after each answer (Quizizz-style "memes").
const MEMES = {
  ar: {
    right: [["🔥", "نار يا بطل!"], ["🚀", "طيران!"], ["🧠", "دماغ ألماظ"], ["😎", "سهلة عليك"], ["🏆", "عاش يا بطل"], ["⚡", "سرعة البرق"]],
    wrong: [["💪", "ولا يهمك، اللي جاي أحسن"], ["🙂", "قربت جداً"], ["📚", "راجعها وهتبقى سهلة"], ["🌱", "كل غلطة بتعلّم"], ["🤝", "كمّل، إنت قدها"]],
  },
  en: {
    right: [["🔥", "On fire!"], ["🚀", "Flying!"], ["🧠", "Big brain"], ["😎", "Too easy"], ["🏆", "Champion"], ["⚡", "Lightning fast"]],
    wrong: [["💪", "Shake it off!"], ["🙂", "So close"], ["📚", "Review it, you'll get it"], ["🌱", "Mistakes help you grow"], ["🤝", "Keep going!"]],
  },
};

/** Self-paced timed quiz with power-ups, streaks and instant feedback. */
export default function QuizGame({ items, onFinish, powerUps = true, timePerQuestion = 20, calm = false }: TemplateProps) {
  const { t, locale } = useI18n();
  const order = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [pos, setPos] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(timePerQuestion);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [meme, setMeme] = useState<[string, string] | null>(null);
  const [lastPoints, setLastPoints] = useState(0);
  const [used, setUsed] = useState({ fifty: false, double: false, freeze: false });
  const [doubleOn, setDoubleOn] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const started = useRef(Date.now());
  const qStart = useRef(Date.now());

  const idx = order[pos];
  const item = items[idx];

  useEffect(() => {
    if (pos >= order.length) return;
    setOptions(optionsFor(items, order[pos]));
    setHidden([]); setPicked(null); setMeme(null); setTimeLeft(timePerQuestion); setFrozen(false);
    qStart.current = Date.now();
  }, [pos, order, items, timePerQuestion]);

  useEffect(() => {
    if (picked !== null || frozen || pos >= order.length) return;
    if (timeLeft <= 0) { choose(""); return; }
    const id = setTimeout(() => { setTimeLeft((s) => s - 1); if (timeLeft <= 4) sfx.tick(); }, 1000);
    return () => clearTimeout(id);
  }, [timeLeft, picked, frozen, pos]);

  const choose = (opt: string) => {
    if (picked !== null) return;
    const correct = opt === item.a;
    const ms = Date.now() - qStart.current;
    setPicked(opt);
    let pts = 0;
    if (correct) {
      pts = Math.round(600 + 400 * (timeLeft / timePerQuestion) + streak * 50) * (doubleOn ? 2 : 1);
      setStreak((s) => s + 1);
      sfx.correct();
    } else {
      setStreak(0);
      sfx.wrong();
    }
    setDoubleOn(false);
    setLastPoints(pts);
    setScore((s) => s + pts);
    const list = MEMES[locale as "ar" | "en"] ?? MEMES.ar;
    const pool = correct ? list.right : list.wrong;
    setMeme(pool[Math.floor(Math.random() * pool.length)] as [string, string]);
    setAnswers((a) => [...a, { i: idx, correct, choice: opt, ms }]);
  };

  const next = () => {
    if (pos + 1 >= order.length) {
      const all = answers;
      onFinish({ score, correct: all.filter((a) => a.correct).length, total: order.length, answers: all, duration_sec: (Date.now() - started.current) / 1000 });
    } else setPos((p) => p + 1);
  };

  const useFifty = () => {
    if (used.fifty || picked) return;
    const wrong = shuffle(options.filter((o) => o !== item.a)).slice(0, Math.max(0, options.length - 2));
    setHidden(wrong); setUsed((u) => ({ ...u, fifty: true }));
  };

  if (!item) return null;

  return (
    <div className="space-y-4">
      {/* Header: progress, timer, score */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono text-slate-500">{pos + 1}/{order.length}</span>
        <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div className={clsx("h-full transition-all duration-1000 ease-linear", timeLeft <= 5 ? "bg-red-500" : "bg-blue-500", frozen && "bg-cyan-400")}
            style={{ width: `${(timeLeft / timePerQuestion) * 100}%` }} />
        </div>
        <span className={clsx("font-bold tabular-nums w-8 text-center", timeLeft <= 5 && "text-red-500")}>{frozen ? "❄️" : timeLeft}</span>
        <span className="font-bold text-amber-600">⭐ {score}</span>
        {streak >= 2 && !calm && <span className="text-orange-500 font-bold">🔥{streak}</span>}
      </div>

      {/* Power-ups */}
      {powerUps && (
        <div className="flex gap-2 justify-center">
          <PowerUp icon="✂️" label={t("games.quiz.fifty")} used={used.fifty} onClick={useFifty} disabled={!!picked} />
          <PowerUp icon="✖️2" label={t("games.quiz.double")} used={used.double} active={doubleOn} disabled={!!picked}
            onClick={() => { if (!used.double) { setDoubleOn(true); setUsed((u) => ({ ...u, double: true })); } }} />
          <PowerUp icon="❄️" label={t("games.quiz.freeze")} used={used.freeze} disabled={!!picked}
            onClick={() => { if (!used.freeze) { setFrozen(true); setUsed((u) => ({ ...u, freeze: true })); } }} />
        </div>
      )}

      <div className="relative rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 text-center min-h-[7rem] flex items-center justify-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">{item.q}</h2>
        {/* Read the question and its options aloud */}
        <button onClick={() => speak([item.q, ...options.filter((o) => !hidden.includes(o))].join("، "))} title={t("games.quiz.readAloud")}
          className="absolute top-2 end-2 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-lg">🔊</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((opt, k) => {
          const isHidden = hidden.includes(opt);
          const reveal = picked !== null;
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={reveal || isHidden}
              className={clsx(
                "relative rounded-2xl px-4 py-5 text-white text-lg font-bold text-start flex items-center gap-3 transition-all",
                OPTION_STYLES[k % 4],
                isHidden && "opacity-0 pointer-events-none",
                reveal && opt === item.a && "ring-4 ring-green-300 scale-[1.02]",
                reveal && opt !== item.a && "opacity-40",
              )}
            >
              <span className="text-2xl opacity-80">{SHAPES[k % 4]}</span>
              <span className="flex-1">{opt}</span>
              {reveal && opt === item.a && <span>✔</span>}
              {reveal && opt === picked && opt !== item.a && <span>✘</span>}
            </button>
          );
        })}
      </div>

      {picked !== null && meme && (
        <div className={clsx("rounded-2xl p-4 flex items-center gap-4", calm ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100" : "bg-slate-900 text-white animate-scene-in")}>
          {!calm && <span className="text-5xl">{meme[0]}</span>}
          <div className="flex-1">
            <p className="font-bold text-lg">{calm ? (picked === item.a ? t("games.quiz.right") : t("games.quiz.wrongPlain")) : meme[1]}</p>
            <p className="text-sm opacity-80">
              {picked === item.a ? t("games.quiz.points", { n: lastPoints }) : picked === "" ? t("games.quiz.timeUp", { answer: item.a }) : t("games.quiz.answerWas", { answer: item.a })}
            </p>
          </div>
          <button onClick={next} className={clsx("px-5 py-2 rounded-xl font-bold", calm ? "bg-blue-600 text-white" : "bg-white text-slate-900")}>{t("games.next")}</button>
        </div>
      )}
    </div>
  );
}

function PowerUp({ icon, label, used, active, disabled, onClick }: { icon: string; label: string; used: boolean; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={used || disabled}
      className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all",
        active ? "border-amber-400 bg-amber-100 text-amber-800" : used ? "border-slate-200 text-slate-300 line-through" : "border-violet-400 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30")}>
      <span>{icon}</span>{label}
    </button>
  );
}

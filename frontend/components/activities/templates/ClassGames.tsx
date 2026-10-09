"use client";
import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { type TemplateProps, type Answer, optionsFor, shuffle, sfx, type Item, useCountdown } from "../shared";

// ── Gold Quest (Blooket-style): answer right → open a treasure chest ──

type Chest = { kind: "gold" | "double" | "triple" | "nothing"; amount?: number };

function rollChest(): Chest {
  const r = Math.random();
  // Chests only ever add: no losing outcomes (nothing staked, nothing lost).
  if (r < 0.65) return { kind: "gold", amount: [10, 20, 30, 40, 50, 75, 100][Math.floor(Math.random() * 7)] };
  if (r < 0.8) return { kind: "double" };
  if (r < 0.86) return { kind: "triple" };
  return { kind: "nothing" };
}

export function GoldQuestGame(props: TemplateProps) {
  const { t } = useI18n();
  const { items } = props;
  const total = Math.max(10, Math.min(items.length * 2, 20));
  const order = useMemo(() => {
    const out: number[] = [];
    while (out.length < total) out.push(...shuffle(items.map((_, i) => i)));
    return out.slice(0, total);
  }, [items, total]);
  const [pos, setPos] = useState(0);
  const [gold, setGold] = useState(0);
  const [phase, setPhase] = useState<"question" | "chests" | "opened" | "wrong">("question");
  const [chests, setChests] = useState<Chest[]>([]);
  const [openedIdx, setOpenedIdx] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const started = useRef(Date.now());
  const idx = order[pos];
  const options = useMemo(() => (idx === undefined ? [] : optionsFor(items, idx)), [idx, items]);
  const finished = useRef(false);
  const finishGame = () => {
    if (finished.current) return;
    finished.current = true;
    props.onFinish({ score: gold, correct: answers.filter((a) => a.correct).length, total: answers.length, answers, duration_sec: (Date.now() - started.current) / 1000 });
  };
  // The teacher's time limit ends the game even mid-question.
  const left = useCountdown(props.gameSeconds, finishGame);

  const answer = (opt: string) => {
    const ok = opt === items[idx].a;
    setAnswers((a) => [...a, { i: idx, correct: ok, choice: opt }]);
    if (ok) { sfx.correct(); setChests([rollChest(), rollChest(), rollChest()]); setPhase("chests"); }
    else { sfx.wrong(); setPhase("wrong"); }
  };
  const open = (k: number) => {
    const c = chests[k];
    setOpenedIdx(k); setPhase("opened");
    setGold((g) => {
      if (c.kind === "gold") { sfx.coin(); return g + (c.amount ?? 0); }
      if (c.kind === "double") { sfx.coin(); return Math.max(g * 2, g + 10); }
      if (c.kind === "triple") { sfx.fanfare(); return Math.max(g * 3, g + 20); }
      return g;
    });
  };
  const next = () => {
    setOpenedIdx(null); setPhase("question");
    if (pos + 1 >= order.length) finishGame();
    else setPos((p) => p + 1);
  };
  const chestLabel = (c: Chest) =>
    c.kind === "gold" ? `+${c.amount} 🪙` : c.kind === "double" ? "×2 🪙" : c.kind === "triple" ? "×3 🪙" : t("games.gold.nothing");

  return (
    <div className="rounded-3xl bg-gradient-to-b from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 p-5">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-amber-800 dark:text-amber-200">{pos + 1}/{order.length}{left !== null && <span className={clsx("ms-3 font-mono font-bold", left <= 10 && "text-red-600")}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>}</span>
        <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">🪙 {gold}</span>
      </div>
      {phase === "question" && (
        <>
          <p className="text-center text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">{items[idx]?.q}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {options.map((o, k) => (
              <button key={o} onClick={() => answer(o)} className={clsx("rounded-2xl py-4 px-3 text-white font-bold shadow",
                ["bg-sky-500", "bg-fuchsia-500", "bg-lime-600", "bg-orange-500"][k % 4])}>{o}</button>
            ))}
          </div>
        </>
      )}
      {phase === "wrong" && (
        <div className="text-center py-6">
          <p className="text-5xl mb-2">😬</p>
          <p className="font-bold text-slate-700 dark:text-slate-200">{t("games.answerWas", { answer: items[idx].a })}</p>
          <button onClick={next} className="mt-4 bg-slate-800 text-white px-6 py-2 rounded-xl font-bold">{t("games.next")}</button>
        </div>
      )}
      {(phase === "chests" || phase === "opened") && (
        <div className="text-center">
          <p className="font-bold text-amber-800 dark:text-amber-200 mb-4">{phase === "chests" ? t("games.gold.pick") : ""}</p>
          <div className="flex justify-center gap-4">
            {chests.map((c, k) => (
              <button key={k} onClick={() => phase === "chests" && open(k)} disabled={phase !== "chests"}
                className={clsx("w-24 h-28 sm:w-28 sm:h-32 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg transition-all",
                  phase === "chests" ? "bg-amber-500 hover:-translate-y-1 hover:bg-amber-400" : openedIdx === k ? "bg-white dark:bg-slate-800 scale-110 animate-pop" : "bg-amber-200 dark:bg-amber-900/40 opacity-60")}>
                <span className="text-4xl">{phase === "chests" ? "🎁" : c.kind === "nothing" ? "🙂" : "💰"}</span>
                {phase === "opened" && <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{chestLabel(c)}</span>}
              </button>
            ))}
          </div>
          {phase === "opened" && <button onClick={next} className="mt-5 bg-slate-800 text-white px-6 py-2 rounded-xl font-bold">{t("games.next")}</button>}
        </div>
      )}
    </div>
  );
}

// ── Random wheel: spin, land on an item, ask it in class ──────

const WHEEL_COLORS = ["#f43f5e", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export function WheelGame({ items }: TemplateProps) {
  const { t } = useI18n();
  const [pool, setPool] = useState(items.map((_, i) => i));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [removeAfter, setRemoveAfter] = useState(true);
  const n = pool.length;
  const seg = 360 / Math.max(1, n);

  const spin = () => {
    if (spinning || n === 0) return;
    const target = Math.floor(Math.random() * n);
    // Pointer is at the top; segment k spans [k*seg, (k+1)*seg) clockwise from the top.
    const final = angle + 360 * 5 + (360 - (target * seg + seg / 2)) - (angle % 360);
    setSpinning(true); setLanded(null); setShowAnswer(false); setAngle(final);
    const ticks = setInterval(sfx.tick, 120);
    setTimeout(() => { clearInterval(ticks); setSpinning(false); setLanded(pool[target]); sfx.fanfare(); }, 4200);
  };
  const done = () => {
    if (removeAfter && landed !== null) setPool((p) => p.filter((i) => i !== landed));
    setLanded(null);
  };

  const arc = (k: number) => {
    const a0 = ((k * seg - 90) * Math.PI) / 180, a1 = (((k + 1) * seg - 90) * Math.PI) / 180;
    const large = seg > 180 ? 1 : 0;
    return `M100 100 L${100 + 98 * Math.cos(a0)} ${100 + 98 * Math.sin(a0)} A98 98 0 ${large} 1 ${100 + 98 * Math.cos(a1)} ${100 + 98 * Math.sin(a1)} Z`;
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 items-center">
      <div className="relative mx-auto w-full max-w-sm aspect-square">
        <span className="absolute left-1/2 -top-1 -translate-x-1/2 text-3xl z-10 drop-shadow">🔻</span>
        <svg viewBox="0 0 200 200" className="w-full h-full" style={{ transform: `rotate(${angle}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(.17,.67,.21,1)" : "none" }}>
          {n === 1 ? <circle cx="100" cy="100" r="98" fill={WHEEL_COLORS[0]} /> : pool.map((i, k) => (
            <g key={i}>
              <path d={arc(k)} fill={WHEEL_COLORS[k % WHEEL_COLORS.length]} stroke="white" strokeWidth="1" />
              <text x="100" y="100" fill="white" fontSize={n > 12 ? 6 : 9} fontWeight="bold" textAnchor="end"
                transform={`rotate(${k * seg + seg / 2 - 90} 100 100) translate(90 3)`}>
                {k + 1}
              </text>
            </g>
          ))}
          <circle cx="100" cy="100" r="12" fill="white" />
        </svg>
        <button onClick={spin} disabled={spinning || n === 0}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-sm shadow-xl disabled:opacity-70">
          {t("games.wheel.spin")}
        </button>
      </div>
      <div className="space-y-3">
        {landed !== null ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border-2 border-violet-300 p-5 animate-pop">
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{items[landed].q}</p>
            {showAnswer ? <p className="mt-3 text-xl font-extrabold text-emerald-600">{items[landed].a}</p> : (
              <button onClick={() => setShowAnswer(true)} className="mt-3 text-sm text-violet-600 font-semibold hover:underline">{t("games.showAnswer")}</button>
            )}
            <button onClick={done} className="mt-4 w-full rounded-xl py-2 bg-violet-600 text-white font-bold">{t("games.next")}</button>
          </div>
        ) : (
          <p className="text-slate-500 text-center">{n === 0 ? t("games.wheel.empty") : t("games.wheel.hint", { n })}</p>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 justify-center">
          <input type="checkbox" checked={removeAfter} onChange={(e) => setRemoveAfter(e.target.checked)} />
          {t("games.wheel.remove")}
        </label>
        {n < items.length && <button onClick={() => setPool(items.map((_, i) => i))} className="block mx-auto text-xs text-slate-500 hover:underline">{t("games.wheel.reset")}</button>}
      </div>
    </div>
  );
}

// ── Team board (Baamboozle-style): one screen, teams take turns ──

type Tile = { kind: "q"; item: number; points: number } | { kind: "swap" | "double" | "gift" };
const POWER_ICONS = { swap: "🔄", double: "✖️2", gift: "🎁" };
const TEAM_COLORS = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-cyan-500"];

export function TeamBoardGame({ items }: { items: Item[] }) {
  const { t } = useI18n();
  const [teams, setTeams] = useState<{ name: string; score: number }[] | null>(null);
  const [teamCount, setTeamCount] = useState(2);
  const [withPowers, setWithPowers] = useState(true);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [usedTiles, setUsedTiles] = useState<number[]>([]);
  const [turn, setTurn] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const start = () => {
    const qs: Tile[] = shuffle(items.map((_, i) => i)).slice(0, 24).map((i) => ({ kind: "q", item: i, points: [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)] }));
    const powers: Tile[] = withPowers
      ? shuffle(["swap", "double", "gift", "gift", "double", "gift"] as const).slice(0, Math.max(2, Math.round(qs.length / 5))).map((k) => ({ kind: k }))
      : [];
    setTiles(shuffle([...qs, ...powers]));
    setTeams(Array.from({ length: teamCount }, (_, k) => ({ name: t("games.board.team", { n: k + 1 }), score: 0 })));
    setUsedTiles([]); setTurn(0);
  };

  const nextTurn = () => { setOpen(null); setRevealed(false); setMessage(null); setTurn((x) => (x + 1) % (teams?.length || 1)); };
  const award = (pts: number) => {
    setTeams((ts) => ts!.map((tm, k) => (k === turn ? { ...tm, score: tm.score + pts } : tm)));
    pts > 0 ? sfx.correct() : sfx.wrong();
    nextTurn();
  };

  const pickTile = (k: number) => {
    if (open !== null || usedTiles.includes(k) || !teams) return;
    setUsedTiles((u) => [...u, k]);
    const tile = tiles[k];
    if (tile.kind === "q") { setOpen(k); return; }
    // Power tiles act immediately.
    const ts = teams.map((x) => ({ ...x }));
    const me = ts[turn];
    // The highest-scoring *other* team (target of swap).
    const others = ts.map((_, i) => i).filter((i) => i !== turn);
    const leader = others.reduce((b, i) => (ts[i].score > ts[b].score ? i : b), others[0] ?? turn);
    let msg = "";
    if (tile.kind === "gift") { me.score += 15; msg = t("games.board.gift", { team: me.name }); sfx.coin(); }
    if (tile.kind === "double") { me.score *= 2; msg = t("games.board.double", { team: me.name }); sfx.fanfare(); }
    if (tile.kind === "swap" && ts.length > 1) { [me.score, ts[leader].score] = [ts[leader].score, me.score]; msg = t("games.board.swap", { team: me.name, other: ts[leader].name }); sfx.coin(); }
    setTeams(ts);
    setOpen(k); setMessage(msg);
  };

  if (!teams) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-6">
        <p className="text-5xl">🏆</p>
        <p className="text-slate-600 dark:text-slate-300 text-sm">{t("games.board.intro")}</p>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{t("games.board.teams")}: {teamCount}
          <input type="range" min={2} max={6} value={teamCount} onChange={(e) => setTeamCount(+e.target.value)} className="w-full mt-2" />
        </label>
        <label className="flex items-center gap-2 justify-center text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={withPowers} onChange={(e) => setWithPowers(e.target.checked)} /> {t("games.board.powers")}
        </label>
        <button onClick={start} className="w-full rounded-xl py-3 bg-blue-600 text-white font-bold">{t("games.board.start")}</button>
      </div>
    );
  }

  const finished = usedTiles.length === tiles.length && open === null;
  const winner = [...teams].sort((a, b) => b.score - a.score)[0];
  const tile = open !== null ? tiles[open] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {teams.map((tm, k) => (
          <div key={k} className={clsx("rounded-xl px-4 py-2 text-white font-bold min-w-[7rem] text-center transition-all", TEAM_COLORS[k % 6], k === turn && !finished ? "ring-4 ring-offset-2 ring-slate-800 dark:ring-white scale-105" : "opacity-80")}>
            <input value={tm.name} onChange={(e) => setTeams((ts) => ts!.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))}
              className="bg-transparent text-center w-full outline-none text-sm" />
            <div className="text-2xl">{tm.score}</div>
          </div>
        ))}
      </div>

      {finished ? (
        <div className="text-center py-10">
          <p className="text-6xl mb-2">🏆</p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{t("games.board.winner", { team: winner.name })}</p>
          <button onClick={() => setTeams(null)} className="mt-4 px-6 py-2 rounded-xl bg-blue-600 text-white font-bold">{t("games.playAgain")}</button>
        </div>
      ) : tile ? (
        <div className="rounded-3xl bg-slate-900 text-white p-8 text-center min-h-[16rem] flex flex-col items-center justify-center gap-4 animate-pop">
          {tile.kind === "q" ? (
            <>
              <span className="text-sm bg-white/20 rounded-full px-3 py-1">{t("games.board.worth", { n: tile.points })}</span>
              <p className="text-2xl sm:text-3xl font-bold">{items[tile.item].q}</p>
              {revealed ? <p className="text-3xl font-extrabold text-emerald-400">{items[tile.item].a}</p> : (
                <button onClick={() => setRevealed(true)} className="text-sm underline opacity-80">{t("games.showAnswer")}</button>
              )}
              <div className="flex gap-3">
                <button onClick={() => award(tile.points)} className="px-6 py-3 rounded-xl bg-emerald-500 font-bold">✓ {t("games.board.correct")}</button>
                <button onClick={() => award(0)} className="px-6 py-3 rounded-xl bg-rose-500 font-bold">✗ {t("games.board.wrong")}</button>
              </div>
            </>
          ) : (
            <>
              <span className="text-6xl">{POWER_ICONS[tile.kind]}</span>
              <p className="text-xl font-bold">{message}</p>
              <button onClick={nextTurn} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold">{t("games.next")}</button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {tiles.map((_, k) => (
            <button key={k} onClick={() => pickTile(k)} disabled={usedTiles.includes(k)}
              className={clsx("aspect-square rounded-xl text-2xl font-extrabold shadow transition-all",
                usedTiles.includes(k) ? "bg-slate-200 dark:bg-slate-800 text-transparent" : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white hover:scale-105")}>
              {k + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

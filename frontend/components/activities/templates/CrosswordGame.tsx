"use client";
import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import { type TemplateProps, wordItems, normalize, sfx } from "../shared";
import { generateCrossword, isRtlText, type Placement } from "../crossword";

export default function CrosswordGame(props: TemplateProps) {
  const { t } = useI18n();
  const cw = useMemo(() => {
    const words = wordItems(props.items).map((w) => ({ word: w.word, clue: w.q, i: w.i }));
    return words.length >= 2 ? generateCrossword(words) : null;
  }, [props.items]);
  const rtl = cw ? isRtlText(Object.values(cw.letters).join("")) : false;
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Placement | null>(null);
  const [checked, setChecked] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const started = useRef(Date.now());

  if (!cw) return <p className="text-center text-slate-500 py-10">{t("games.needWords")}</p>;

  const cellsOf = (p: Placement) => [...p.word].map((_, j) => p.dir === "across" ? `${p.row},${p.col + j}` : `${p.row + j},${p.col}`);
  const numberAt = new Map(cw.placements.map((p) => [`${p.row},${p.col}`, p.number]));
  const activeCells = active ? new Set(cellsOf(active)) : new Set<string>();
  const cellOk = (k: string) => normalize(values[k] || "") === normalize(cw.letters[k]);
  const wordOk = (p: Placement) => cellsOf(p).every(cellOk);

  const onType = (k: string, v: string) => {
    const ch = v.slice(-1);
    setValues((s) => ({ ...s, [k]: ch }));
    setChecked(false);
    if (ch && active) {
      const cells = cellsOf(active);
      const next = cells[cells.indexOf(k) + 1];
      if (next) refs.current[next]?.focus();
    }
  };
  const focusCell = (k: string) => {
    if (!active || !activeCells.has(k)) {
      const p = cw.placements.find((pl) => cellsOf(pl).includes(k) && pl.dir === "across") ?? cw.placements.find((pl) => cellsOf(pl).includes(k));
      if (p) setActive(p);
    }
  };

  const check = () => {
    setChecked(true);
    const okCount = cw.placements.filter(wordOk).length;
    okCount === cw.placements.length ? sfx.fanfare() : sfx.tick();
  };
  const finish = () => {
    const answers = cw.placements.map((p) => ({ i: p.i, correct: wordOk(p), choice: cellsOf(p).map((k) => values[k] || "").join("") }));
    const correct = answers.filter((a) => a.correct).length;
    props.onFinish({ score: correct * 150, correct, total: answers.length, answers, duration_sec: (Date.now() - started.current) / 1000 });
  };

  const clueList = (dir: "across" | "down") => cw.placements.filter((p) => p.dir === dir);

  return (
    <div className="grid lg:grid-cols-[auto,1fr] gap-6 items-start">
      <div className="overflow-auto">
        <div className="inline-grid gap-0.5 bg-slate-300 dark:bg-slate-600 p-0.5 rounded-lg" dir={rtl ? "rtl" : "ltr"}
          style={{ gridTemplateColumns: `repeat(${cw.cols}, 2.4rem)` }}>
          {Array.from({ length: cw.rows * cw.cols }, (_, n) => {
            const r = Math.floor(n / cw.cols), c = n % cw.cols, k = `${r},${c}`;
            if (!cw.letters[k]) return <div key={k} className="w-[2.4rem] h-[2.4rem] bg-slate-100 dark:bg-slate-900" />;
            return (
              <div key={k} className="relative w-[2.4rem] h-[2.4rem]">
                {numberAt.has(k) && <span className="absolute top-0 start-0.5 text-[9px] font-bold text-slate-500 z-10">{numberAt.get(k)}</span>}
                <input
                  ref={(el) => { refs.current[k] = el; }}
                  value={values[k] || ""}
                  onChange={(e) => onType(k, e.target.value)}
                  onFocus={() => focusCell(k)}
                  className={clsx("w-full h-full text-center text-lg font-bold uppercase outline-none",
                    checked ? (cellOk(k) ? "bg-green-100 dark:bg-green-900/40" : values[k] ? "bg-red-100 dark:bg-red-900/40" : "bg-white dark:bg-slate-800")
                      : activeCells.has(k) ? "bg-blue-100 dark:bg-blue-900/40" : "bg-white dark:bg-slate-800")}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-4 text-sm">
        {(["across", "down"] as const).map((dir) => clueList(dir).length > 0 && (
          <div key={dir}>
            <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-1">{t(`games.crossword.${dir}`)}</h4>
            <ul className="space-y-1">
              {clueList(dir).map((p) => (
                <li key={dir + p.number}>
                  <button onClick={() => { setActive(p); refs.current[cellsOf(p)[0]]?.focus(); }}
                    className={clsx("text-start w-full rounded px-2 py-1", active === p ? "bg-blue-50 dark:bg-blue-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                      checked && wordOk(p) && "text-green-600 line-through")}>
                    <b>{p.number}.</b> {p.clue} <span className="text-slate-400">({p.word.length})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={check} className="flex-1 rounded-xl py-2 border-2 border-blue-500 text-blue-600 font-bold">{t("games.check")}</button>
          <button onClick={finish} className="flex-1 rounded-xl py-2 bg-blue-600 text-white font-bold">{t("games.finish")}</button>
        </div>
      </div>
    </div>
  );
}

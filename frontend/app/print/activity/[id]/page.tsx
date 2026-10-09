"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { type Item, optionsFor, seeded, shuffle, wordItems, PRINTABLE_TEMPLATES, type TemplateKey } from "@/components/activities/shared";
import { generateCrossword, isRtlText } from "@/components/activities/crossword";

/** Printable worksheet (and optional answer key) for an activity — print or "Save as PDF". */
export default function PrintActivity() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useI18n();
  const [activity, setActivity] = useState<{ title: string; items: Item[] } | null>(null);
  const [error, setError] = useState(false);
  const [template, setTemplate] = useState<TemplateKey>("quiz");
  const [withKey, setWithKey] = useState(true);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("t") as TemplateKey | null;
    if (fromUrl && PRINTABLE_TEMPLATES.includes(fromUrl)) setTemplate(fromUrl);
    activitiesAPI.get(id).then(({ data }) => setActivity(data)).catch(() => setError(true));
  }, [id]);

  // Same seed → the worksheet and its answer key always agree.
  const seed = useMemo(() => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7), [id]);

  if (error) return <p className="p-10 text-center">{t("games.loadError")}</p>;
  if (!activity) return <p className="p-10 text-center text-slate-400">…</p>;
  const items = activity.items;

  return (
    <div dir={dir} className="bg-slate-100 min-h-screen print:bg-white">
      <style dangerouslySetInnerHTML={{ __html: "@page { margin: 14mm } @media print { .page-break { break-before: page } }" }} />
      <div className="print:hidden sticky top-0 bg-white border-b p-3 flex flex-wrap gap-2 items-center justify-center z-10">
        {PRINTABLE_TEMPLATES.map((k) => (
          <button key={k} onClick={() => setTemplate(k)} className={`px-3 py-1.5 rounded-lg text-sm border ${k === template ? "bg-blue-600 text-white border-blue-600" : "border-slate-300"}`}>
            {t(`games.templates.${k}`)}
          </button>
        ))}
        <label className="flex items-center gap-1 text-sm mx-3"><input type="checkbox" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} /> {t("games.printPage.withKey")}</label>
        <button onClick={() => window.print()} className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-bold">🖨️ {t("games.printPage.print")}</button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white p-[12mm] my-6 shadow print:shadow-none print:my-0 print:p-0 text-slate-900">
        <Header title={activity.title} subtitle={t(`games.templates.${template}`)} t={t} />
        <Worksheet template={template} items={items} seed={seed} t={t} answers={false} />
        {withKey && (
          <div className="page-break mt-12 print:mt-0">
            <h2 className="text-lg font-bold border-b-2 border-slate-800 pb-1 mb-4">🔑 {t("games.printPage.answerKey")} — {activity.title}</h2>
            <Worksheet template={template} items={items} seed={seed} t={t} answers />
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ title, subtitle, t }: { title: string; subtitle: string; t: (k: string) => string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <div className="flex gap-8 mt-4 text-sm">
        <span className="flex-1">{t("games.printPage.name")}: ..............................................</span>
        <span>{t("games.printPage.date")}: ....................</span>
        <span>{t("games.printPage.score")}: ........</span>
      </div>
    </div>
  );
}

function Worksheet({ template, items, seed, t, answers }: { template: TemplateKey; items: Item[]; seed: number; t: (k: string, v?: any) => string; answers: boolean }) {
  const rand = seeded(seed);
  const letters = ["أ", "ب", "ج", "د"];

  if (template === "quiz") {
    return (
      <ol className="space-y-4 list-decimal ps-6">
        {items.map((it, i) => {
          const opts = optionsFor(items, i, rand);
          return (
            <li key={i} className="break-inside-avoid">
              <p className="font-semibold mb-1">{it.q}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {opts.map((o, k) => (
                  <span key={k} className={answers && o === it.a ? "font-bold underline" : ""}>
                    <span className="inline-block w-5 h-5 border border-slate-700 rounded-full text-center text-xs leading-5 me-2">{answers && o === it.a ? "✓" : letters[k]}</span>{o}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  if (template === "truefalse") {
    const rows = items.map((it, i) => {
      const others = items.filter((x) => x.a !== it.a);
      const truth = others.length === 0 || rand() < 0.5;
      return { q: it.q, shown: truth ? it.a : others[Math.floor(rand() * others.length)].a, truth, i };
    });
    return (
      <ol className="space-y-3 list-decimal ps-6">
        {rows.map((r) => (
          <li key={r.i} className="break-inside-avoid flex justify-between gap-4">
            <span>{r.q} ← <b>{r.shown}</b></span>
            <span className="whitespace-nowrap text-sm">
              {answers ? <b>{r.truth ? t("games.true") : t("games.false")}</b> : <>☐ {t("games.true")} &nbsp; ☐ {t("games.false")}</>}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (template === "match") {
    const shuffled = shuffle(items.map((_, i) => i), rand);
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return (
      <div>
        <p className="text-sm text-slate-500 mb-3">{t("games.printPage.matchHowTo")}</p>
        <div className="grid grid-cols-2 gap-x-10">
          <ol className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2 items-center"><b>{i + 1}.</b> <span className="flex-1">{it.q}</span>
                <span className="w-8 h-6 border-b border-slate-700 text-center font-bold">{answers ? abc[shuffled.indexOf(i)] : ""}</span></li>
            ))}
          </ol>
          <ol className="space-y-3">
            {shuffled.map((j, k) => <li key={j}><b>{abc[k]}.</b> {items[j].a}</li>)}
          </ol>
        </div>
      </div>
    );
  }

  if (template === "anagram") {
    return (
      <ol className="space-y-4 list-decimal ps-6">
        {wordItems(items).map((w) => (
          <li key={w.i} className="break-inside-avoid">
            <p>{w.q}</p>
            <p className="font-mono text-lg tracking-[.4em] my-1">{shuffle([...w.word], rand).join(" ")}</p>
            <div className="flex gap-1" dir={isRtlText(w.word) ? "rtl" : "ltr"}>
              {[...w.word].map((ch, k) => <span key={k} className="w-7 h-8 border border-slate-700 text-center font-bold leading-8">{answers ? ch : ""}</span>)}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  if (template === "crossword") {
    const words = wordItems(items).map((w) => ({ word: w.word, clue: w.q, i: w.i }));
    if (words.length < 2) return <p>{t("games.needWords")}</p>;
    const cw = generateCrossword(words);
    const rtl = isRtlText(Object.values(cw.letters).join(""));
    const num = new Map(cw.placements.map((p) => [`${p.row},${p.col}`, p.number]));
    return (
      <div className="space-y-6">
        <div className="inline-grid gap-0 border border-slate-800" dir={rtl ? "rtl" : "ltr"} style={{ gridTemplateColumns: `repeat(${cw.cols}, 9mm)` }}>
          {Array.from({ length: cw.rows * cw.cols }, (_, n) => {
            const k = `${Math.floor(n / cw.cols)},${n % cw.cols}`;
            return cw.letters[k] ? (
              <div key={k} className="relative w-[9mm] h-[9mm] border border-slate-800 text-center font-bold leading-[9mm]">
                {num.has(k) && <span className="absolute top-0 start-0.5 text-[7px] leading-none">{num.get(k)}</span>}
                {answers ? cw.letters[k] : ""}
              </div>
            ) : <div key={k} className="w-[9mm] h-[9mm] bg-slate-800" />;
          })}
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          {(["across", "down"] as const).map((d) => (
            <div key={d}>
              <h4 className="font-bold mb-1">{t(`games.crossword.${d}`)}</h4>
              {cw.placements.filter((p) => p.dir === d).map((p) => (
                <p key={d + p.number}><b>{p.number}.</b> {p.clue} ({p.word.length}){answers && <b> — {p.word}</b>}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // flashcards: cut-out cards, question | answer
  return (
    <div className="grid grid-cols-2 border-t border-s border-dashed border-slate-500">
      {items.map((it, i) => (
        [<div key={`q${i}`} className="min-h-[30mm] border-b border-e border-dashed border-slate-500 p-3 flex items-center justify-center text-center font-semibold break-inside-avoid">{it.q}</div>,
         <div key={`a${i}`} className="min-h-[30mm] border-b border-e border-dashed border-slate-500 p-3 flex items-center justify-center text-center text-lg font-bold break-inside-avoid">{it.a}</div>]
      ))}
    </div>
  );
}

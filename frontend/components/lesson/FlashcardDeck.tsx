"use client";
import { useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

interface FlashcardType {
  front: string;
  back: string;
  hint?: string;
  category?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "تعريف":   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "مفهوم":   "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "قانون":   "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "مثال":    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "default": "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

function Flashcard({ card, index, total }: { card: FlashcardType; index: number; total: number }) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const colorClass = CATEGORY_COLORS[card.category ?? ""] ?? CATEGORY_COLORS.default;

  return (
    <div className="flex flex-col items-center">
      {/* Counter */}
      <div className="text-xs text-slate-400 mb-3 font-mono">{index + 1} / {total}</div>

      {/* Card flip container */}
      <div
        className="w-full max-w-md cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => { setFlipped(!flipped); setHintVisible(false); }}
      >
        <div
          className="relative transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            height: "220px",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 rounded-2xl p-6 flex flex-col justify-between shadow-md"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-center justify-between">
              {card.category && (
                <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", colorClass)}>
                  {card.category}
                </span>
              )}
              <span className="text-xs text-slate-400 mr-auto">{t("dashboard.flashcards.flipHint")}</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                {card.front}
              </p>
            </div>
            <div className="flex justify-center">
              {card.hint && !hintVisible && (
                <button
                  onClick={(e) => { e.stopPropagation(); setHintVisible(true); }}
                  className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 px-3 py-1 rounded-full transition-colors"
                >
                  {t("dashboard.flashcards.hintButton")}
                </button>
              )}
              {hintVisible && card.hint && (
                <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                  💡 {card.hint}
                </p>
              )}
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-blue-600 rounded-2xl p-6 flex flex-col justify-center items-center shadow-md"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <div className="text-center">
              <p className="text-white text-base leading-relaxed font-medium">
                {card.back}
              </p>
            </div>
            <p className="text-blue-200 text-xs mt-4">{t("dashboard.flashcards.flipBackHint")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FlashcardDeck({
  cards,
  onReset,
  resetting,
}: {
  cards: FlashcardType[];
  onReset?: () => void;
  resetting?: boolean;
}) {
  const { t, dir } = useI18n();
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<"one" | "grid">("one");
  const [done, setDone] = useState<Set<number>>(new Set());

  const markDone = (i: number) => setDone((prev) => { const s = new Set(prev); s.add(i); return s; });

  const goNext = () => {
    markDone(current);
    if (current < cards.length - 1) setCurrent(current + 1);
  };

  const goPrev = () => { if (current > 0) setCurrent(current - 1); };

  const restart = () => { setCurrent(0); setDone(new Set()); };

  if (cards.length === 0) return (
    <div className="text-center text-slate-400 py-12">{t("dashboard.flashcards.empty")}</div>
  );

  const allDone = done.size >= cards.length;

  return (
    <div dir={dir}>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("one")}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              mode === "one" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")}
          >
            {t("dashboard.flashcards.oneByOne")}
          </button>
          <button
            onClick={() => setMode("grid")}
            className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              mode === "grid" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700")}
          >
            {t("dashboard.flashcards.gridView")}
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-500">{t("dashboard.flashcards.doneCount", { done: done.size, total: cards.length })}</span>
          {onReset && (
            <button
              onClick={onReset}
              disabled={resetting}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              title={t("dashboard.flashcards.regenerateTooltip")}
            >
              {resetting ? "⏳" : t("dashboard.flashcards.regenerate")}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-6">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${(done.size / cards.length) * 100}%` }}
        />
      </div>

      {/* Celebration screen */}
      {allDone && mode === "one" ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            {t("dashboard.flashcards.allDoneTitle")}
          </h3>
          <p className="text-slate-500 mb-6">{t("dashboard.flashcards.allDoneSubtitle")}</p>
          <button
            onClick={restart}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            {t("dashboard.flashcards.restart")}
          </button>
        </div>
      ) : mode === "one" ? (
        <div className="space-y-6">
          <Flashcard card={cards[current]} index={current} total={cards.length} />

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={goPrev}
              disabled={current === 0}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t("dashboard.flashcards.prev")}
            </button>
            <button
              onClick={goNext}
              disabled={current === cards.length - 1}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {done.has(current) ? t("dashboard.flashcards.next") : t("dashboard.flashcards.gotIt")}
            </button>
          </div>

          {/* Dots nav */}
          <div className="flex justify-center gap-1.5 flex-wrap">
            {cards.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full transition-all",
                  i === current ? "bg-blue-600 scale-125" :
                  done.has(i) ? "bg-green-400" : "bg-slate-300 dark:bg-slate-600"
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Grid mode */
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card, i) => (
            <GridCard key={i} card={card} flipHint={t("dashboard.flashcards.gridFlipHint")} />
          ))}
        </div>
      )}
    </div>
  );
}

function GridCard({ card, flipHint }: { card: FlashcardType; flipHint: string }) {
  const [flipped, setFlipped] = useState(false);
  const colorClass = CATEGORY_COLORS[card.category ?? ""] ?? CATEGORY_COLORS.default;
  return (
    <div
      className="cursor-pointer"
      style={{ perspective: "800px" }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          height: "160px",
        }}
      >
        <div
          className="absolute inset-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-sm"
          style={{ backfaceVisibility: "hidden" }}
        >
          {card.category && (
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium self-start", colorClass)}>
              {card.category}
            </span>
          )}
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm text-center">{card.front}</p>
          <p className="text-xs text-slate-400 text-center">{flipHint}</p>
        </div>
        <div
          className="absolute inset-0 bg-blue-600 rounded-xl p-4 flex items-center justify-center"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-white text-sm text-center leading-relaxed">{card.back}</p>
        </div>
      </div>
    </div>
  );
}

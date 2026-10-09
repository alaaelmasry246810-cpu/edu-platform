"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { type GameResult, type Item, type TemplateKey, TEMPLATE_ICONS, SOLO_TEMPLATES, PRINTABLE_TEMPLATES, sfx, setMuted } from "./shared";
import QuizGame from "./templates/QuizGame";
import CrosswordGame from "./templates/CrosswordGame";
import { TrueFalseGame, MatchGame, FlashcardsGame, AnagramGame, SpellItGame } from "./templates/SimpleGames";
import { GoldQuestGame, WheelGame, TeamBoardGame } from "./templates/ClassGames";
import { TowerGame } from "./templates/ArcadeGames";

interface Props {
  activity: { id: string; title: string; items: Item[]; template: string; power_ups?: boolean; time_per_question?: number; calm_mode?: boolean; game_minutes?: number | null };
  /** Save each finished play (students). */
  saveAttempts?: boolean;
  /** Whole-class templates (team board) — for the teacher's screen. */
  classroom?: boolean;
}

/** One set of items, many games: switch template without rewriting anything. */
export default function ActivityPlayer({ activity, saveAttempts, classroom }: Props) {
  const { t } = useI18n();
  const templates: TemplateKey[] = classroom ? [...SOLO_TEMPLATES, "teamboard"] : SOLO_TEMPLATES;
  const initial = (templates.includes(activity.template as TemplateKey) ? activity.template : "quiz") as TemplateKey;
  const [template, setTemplate] = useState<TemplateKey>(initial);
  const [result, setResult] = useState<GameResult | null>(null);
  const [round, setRound] = useState(0);
  const calm = !!activity.calm_mode;
  useEffect(() => { setMuted(calm); return () => setMuted(false); }, [calm]);

  const onFinish = async (r: GameResult) => {
    setResult(r);
    sfx.fanfare();
    if (saveAttempts) {
      try {
        await activitiesAPI.saveAttempt(activity.id, { template, ...r });
      } catch {
        toast.error(t("games.saveError"));
      }
    }
  };
  const play = (k: TemplateKey) => { setTemplate(k); setResult(null); setRound((n) => n + 1); };

  const props = {
    items: activity.items, onFinish, calm,
    powerUps: activity.power_ups ?? true,
    timePerQuestion: activity.time_per_question ?? 20,
    gameSeconds: activity.game_minutes ? activity.game_minutes * 60 : undefined,
  };
  const pct = result && result.total ? Math.round((100 * result.correct) / result.total) : 0;

  if (activity.items.length < 2) return <p className="text-center text-slate-500 py-10">{t("games.needItems")}</p>;

  return (
    <div className="space-y-5">
      {/* Template switcher */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {templates.map((k) => (
          <button key={k} onClick={() => play(k)}
            className={clsx("shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border-2 transition-colors",
              k === template ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
            <span>{TEMPLATE_ICONS[k]}</span>{t(`games.templates.${k}`)}
          </button>
        ))}
        {PRINTABLE_TEMPLATES.includes(template) && (
          <a href={`/print/activity/${activity.id}?t=${template}`} target="_blank" rel="noreferrer"
            className="shrink-0 ms-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300">
            🖨️ {t("games.print")}
          </a>
        )}
      </div>

      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 sm:p-6">
        {result ? (
          <div className="text-center py-8 space-y-3 animate-pop">
            <p className="text-6xl">{pct >= 90 ? "🏆" : pct >= 70 ? "🎉" : pct >= 50 ? "👍" : "💪"}</p>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">{t("games.result.score", { n: result.score })}</p>
            {result.total > 0 && <p className="text-slate-500">{t("games.result.correct", { correct: result.correct, total: result.total, pct })}</p>}
            <div className="flex gap-2 justify-center pt-2">
              <button onClick={() => play(template)} className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold">🔁 {t("games.playAgain")}</button>
              <button onClick={() => play(templates[(templates.indexOf(template) + 1) % templates.length])} className="px-5 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200">
                🎲 {t("games.tryAnother")}
              </button>
            </div>
          </div>
        ) : (
          <div key={`${template}-${round}`}>
            {template === "quiz" && <QuizGame {...props} />}
            {template === "truefalse" && <TrueFalseGame {...props} />}
            {template === "match" && <MatchGame {...props} />}
            {template === "flashcards" && <FlashcardsGame {...props} />}
            {template === "anagram" && <AnagramGame {...props} />}
            {template === "spellit" && <SpellItGame {...props} />}
            {template === "crossword" && <CrosswordGame {...props} />}
            {template === "goldquest" && <GoldQuestGame {...props} />}
            {template === "tower" && <TowerGame {...props} />}
            {template === "wheel" && <WheelGame {...props} />}
            {template === "teamboard" && <TeamBoardGame items={activity.items} />}
          </div>
        )}
      </div>
    </div>
  );
}

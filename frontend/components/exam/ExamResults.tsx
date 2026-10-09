"use client";
import { useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import type { ExamResult } from "./types";

export default function ExamResults({ result, onRetry, retryLabel }: { result: ExamResult; onRetry: () => void; retryLabel?: string }) {
  const { t, dir } = useI18n();
  const [expanded, setExpanded] = useState<number | null>(null);
  const pct = result.percentage ?? Math.round((result.total_score / result.max_score) * 100);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4" dir={dir}>
      {/* Summary card */}
      <div className={clsx(
        "rounded-2xl p-6 mb-6 text-center border-2",
        result.passed
          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
          : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700"
      )}>
        <div className="text-5xl mb-2">{result.passed ? "🎉" : "😔"}</div>
        <h2 className={clsx("text-2xl font-black mb-1", result.passed ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
          {result.passed ? t("dashboard.exam.results.passed") : t("dashboard.exam.results.failed")}
        </h2>
        <div className="text-4xl font-black mt-3 mb-1">
          {result.total_score?.toFixed(1)} / {result.max_score?.toFixed(1)}
        </div>
        <div className={clsx("text-lg font-bold", result.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
          {pct?.toFixed(1)}%
        </div>

        {result.needs_manual_grading && (
          <div className="mt-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-sm px-4 py-2 rounded-xl inline-block">
            {t("dashboard.exam.results.pendingManual")}
          </div>
        )}
      </div>

      {/* Per-question breakdown */}
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3">{t("dashboard.exam.results.breakdownTitle")}</h3>
      <div className="space-y-3">
        {result.question_results?.map((res, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              className={clsx(
                "border rounded-xl overflow-hidden",
                res.needs_manual ? "border-amber-300 dark:border-amber-700" :
                res.is_correct ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700"
              )}
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-right"
              >
                <span className={clsx("text-lg flex-shrink-0",
                  res.needs_manual ? "text-amber-500" :
                  res.is_correct ? "text-green-600" : "text-red-600"
                )}>
                  {res.needs_manual ? "⏳" : res.is_correct ? "✅" : "❌"}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 text-right line-clamp-1">
                  {res.question || t("dashboard.exam.results.questionFallback", { number: res.q_index + 1 })}
                </span>
                <span className={clsx("text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full",
                  res.needs_manual ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                  res.is_correct ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                 : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                )}>
                  {res.points_earned != null ? `${res.points_earned}/${res.max_points}` : `?/${res.max_points}`}
                </span>
                <span className="text-slate-400 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Expanded */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                  {/* Student answer */}
                  <div className="text-sm">
                    <span className="text-slate-500 text-xs">{t("dashboard.exam.results.yourAnswer")} </span>
                    <span className={clsx("font-medium",
                      res.is_correct === null ? "text-slate-700 dark:text-slate-300" :
                      res.is_correct ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    )}>
                      {res.student_answer || "—"}
                    </span>
                  </div>

                  {/* Correct answer */}
                  {!res.is_correct && !res.needs_manual && (
                    <div className="text-sm">
                      <span className="text-slate-500 text-xs">{t("dashboard.exam.results.correctAnswer")} </span>
                      <span className="font-bold text-green-700 dark:text-green-400">{res.correct_answer}</span>
                    </div>
                  )}

                  {/* MCQ options */}
                  {res.options && (
                    <div className="space-y-1 mt-2">
                      {res.options.map((opt, oi) => (
                        <div key={oi} className={clsx(
                          "text-xs px-3 py-1.5 rounded-lg flex items-center gap-2",
                          !res.needs_manual && opt === res.correct_answer ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-bold" :
                          !res.needs_manual && opt === res.student_answer && res.is_correct === false ? "bg-red-100 dark:bg-red-900/20 text-red-700 line-through" :
                          opt === res.student_answer ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold" :
                          "bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400"
                        )}>
                          <span>{["أ","ب","ج","د"][oi]}</span> {opt}
                          {opt === res.correct_answer && <span className="mr-auto">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Why the wrong answer is wrong */}
                  {!res.is_correct && !res.needs_manual && res.why_wrong && (
                    <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 leading-relaxed">
                      <span className="font-semibold">{t("dashboard.exam.results.whyWrongLabel")} </span>
                      {res.why_wrong}
                    </div>
                  )}

                  {/* Why the correct answer is correct */}
                  {res.explanation && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 leading-relaxed">
                      <span className="font-semibold">{t("dashboard.exam.results.whyCorrectLabel")} </span>
                      {res.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onRetry}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors"
        >
          {retryLabel ?? t("dashboard.exam.results.newExam")}
        </button>
      </div>
    </div>
  );
}

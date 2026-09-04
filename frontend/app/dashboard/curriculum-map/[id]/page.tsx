"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { curriculumAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Lesson {
  id: string;
  title: string;
  order: number;
  has_summary: boolean;
  video_url?: string | null;
}

interface Unit {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CurriculumStructure {
  id: string;
  title: string;
  subject?: string;
  grade_level?: string;
  units: Unit[];
}

// Color palette for units
const UNIT_COLORS = [
  { bg: "#3b82f6", light: "#dbeafe", border: "#93c5fd", text: "#1e40af" },  // blue
  { bg: "#8b5cf6", light: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" },  // purple
  { bg: "#10b981", light: "#d1fae5", border: "#6ee7b7", text: "#065f46" },  // green
  { bg: "#f59e0b", light: "#fef3c7", border: "#fcd34d", text: "#92400e" },  // amber
  { bg: "#ef4444", light: "#fee2e2", border: "#fca5a5", text: "#991b1b" },  // red
  { bg: "#06b6d4", light: "#cffafe", border: "#67e8f9", text: "#155e75" },  // cyan
  { bg: "#ec4899", light: "#fce7f3", border: "#f9a8d4", text: "#9d174d" },  // pink
  { bg: "#84cc16", light: "#f7fee7", border: "#bef264", text: "#3f6212" },  // lime
];

export default function CurriculumMapPage() {
  const { id } = useParams() as { id: string };
  const { t, dir } = useI18n();
  const [curriculum, setCurriculum] = useState<CurriculumStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredLesson, setHoveredLesson] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  useEffect(() => {
    curriculumAPI.structure(id)
      .then((r) => setCurriculum(r.data))
      .catch(() => setError(t("dashboard.curriculumMap.loadError")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" dir={dir}>
      <div className="text-center">
        <div className="text-4xl animate-spin inline-block mb-4">🗺️</div>
        <p className="text-slate-500">{t("dashboard.curriculumMap.loading")}</p>
      </div>
    </div>
  );

  if (error || !curriculum) return (
    <div className="min-h-screen flex items-center justify-center" dir={dir}>
      <div className="text-center">
        <p className="text-red-500 mb-4">{error || t("dashboard.curriculumMap.notFound")}</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline">{t("dashboard.curriculumMap.back")}</Link>
      </div>
    </div>
  );

  const totalLessons = curriculum.units.reduce((s, u) => s + u.lessons.length, 0);
  const completedLessons = curriculum.units.reduce(
    (s, u) => s + u.lessons.filter((l) => l.has_summary).length, 0
  );
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900" dir={dir}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 text-sm">{t("dashboard.curriculumMap.back")}</Link>
            <span className="text-slate-300">|</span>
            <span className="text-xl">🗺️</span>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white">{curriculum.title}</h1>
              {curriculum.grade_level && (
                <p className="text-xs text-slate-500">{curriculum.grade_level}</p>
              )}
            </div>
          </div>
          {/* Overall progress */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500">
              <span className="font-bold text-slate-800 dark:text-white">{completedLessons}</span>/{totalLessons} {t("dashboard.curriculumMap.lessonsCompleted")}
            </div>
            <div className="w-40 bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? "#10b981" : "#3b82f6" }}
              />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{progressPct}%</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-2 flex items-center gap-6 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-green-400 bg-green-100" />
          <span>{t("dashboard.curriculumMap.legend.completed")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-slate-300 bg-white dark:bg-slate-700" />
          <span>{t("dashboard.curriculumMap.legend.incomplete")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-yellow-400 bg-yellow-100" />
          <span>{t("dashboard.curriculumMap.legend.hasVideo")}</span>
        </div>
      </div>

      {/* Map */}
      <div className="max-w-7xl mx-auto px-6 pb-16 pt-4">
        {curriculum.units.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-5xl mb-4">📭</p>
            <p>{t("dashboard.curriculumMap.noUnits")}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {curriculum.units.map((unit, unitIdx) => {
              const color = UNIT_COLORS[unitIdx % UNIT_COLORS.length];
              const unitCompleted = unit.lessons.filter((l) => l.has_summary).length;
              const unitPct = unit.lessons.length > 0
                ? Math.round((unitCompleted / unit.lessons.length) * 100) : 0;
              const isSelected = selectedUnit === unit.id;

              return (
                <div key={unit.id} className="relative">
                  {/* Vertical line connecting to next unit */}
                  {unitIdx < curriculum.units.length - 1 && (
                    <div
                      className="absolute right-[27px] bottom-[-40px] w-1 h-10 rounded-full opacity-30"
                      style={{ backgroundColor: color.bg }}
                    />
                  )}

                  {/* Unit header */}
                  <button
                    onClick={() => setSelectedUnit(isSelected ? null : unit.id)}
                    className="flex items-center gap-4 w-full text-right group mb-4"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ backgroundColor: color.bg }}
                    >
                      {unitIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-bold text-slate-900 dark:text-white text-base">{unit.title}</h2>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: color.light, color: color.text, border: `1px solid ${color.border}` }}
                        >
                          {unit.lessons.length} {t("dashboard.curriculumMap.lessonsCount")}
                        </span>
                        {unitPct === 100 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{t("dashboard.curriculumMap.unitCompleted")}</span>
                        )}
                      </div>
                      {/* Unit progress bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 max-w-xs">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${unitPct}%`, backgroundColor: color.bg }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{unitCompleted}/{unit.lessons.length}</span>
                      </div>
                    </div>
                    <span className="text-slate-400 transition-transform" style={{ transform: isSelected ? "rotate(90deg)" : "none" }}>▶</span>
                  </button>

                  {/* Lessons grid */}
                  <div className="mr-18 pr-[4.5rem]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {unit.lessons.map((lesson, lessonIdx) => {
                        const isDone = lesson.has_summary;
                        const hasVideo = !!lesson.video_url;
                        const isHovered = hoveredLesson === lesson.id;

                        return (
                          <div key={lesson.id} className="relative">
                            {/* Connector line to previous */}
                            {lessonIdx > 0 && (
                              <div
                                className="absolute top-1/2 right-[-12px] w-3 h-0.5 opacity-30"
                                style={{ backgroundColor: color.bg }}
                              />
                            )}
                            <Link
                              href={`/dashboard/lesson/${lesson.id}`}
                              onMouseEnter={() => setHoveredLesson(lesson.id)}
                              onMouseLeave={() => setHoveredLesson(null)}
                              className="block relative group"
                            >
                              {/* Lesson card */}
                              <div
                                className="rounded-xl p-3 border-2 transition-all duration-200 cursor-pointer"
                                style={{
                                  backgroundColor: isDone ? color.light : "white",
                                  borderColor: isDone ? color.bg : isHovered ? color.border : "#e2e8f0",
                                  transform: isHovered ? "translateY(-2px)" : "none",
                                  boxShadow: isHovered ? `0 8px 20px ${color.bg}33` : "0 1px 3px rgba(0,0,0,0.08)",
                                }}
                              >
                                {/* Status dot */}
                                <div className="flex items-center justify-between mb-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: isDone ? color.bg : "#cbd5e1" }}
                                  />
                                  {hasVideo && (
                                    <span className="text-xs" title={t("dashboard.curriculumMap.legend.hasVideo")}>🎬</span>
                                  )}
                                </div>

                                {/* Lesson number */}
                                <div
                                  className="text-xs font-bold mb-1"
                                  style={{ color: isDone ? color.text : "#94a3b8" }}
                                >
                                  {unitIdx + 1}.{lesson.order + 1}
                                </div>

                                {/* Lesson title */}
                                <p
                                  className="text-xs font-medium leading-tight line-clamp-3"
                                  style={{ color: isDone ? color.text : "#475569" }}
                                >
                                  {lesson.title}
                                </p>

                                {/* Done checkmark */}
                                {isDone && (
                                  <div
                                    className="mt-2 text-center text-xs font-bold"
                                    style={{ color: color.bg }}
                                  >
                                    ✓
                                  </div>
                                )}
                              </div>

                              {/* Hover tooltip */}
                              {isHovered && (
                                <div className="absolute bottom-full mb-2 right-0 z-20 bg-slate-900 text-white text-xs rounded-lg px-3 py-2 w-48 shadow-xl pointer-events-none">
                                  <p className="font-medium mb-1">{lesson.title}</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {isDone && <span className="text-green-400">{t("dashboard.curriculumMap.tooltip.completed")}</span>}
                                    {hasVideo && <span className="text-yellow-400">{t("dashboard.curriculumMap.tooltip.video")}</span>}
                                    {!isDone && <span className="text-slate-400">{t("dashboard.curriculumMap.tooltip.incomplete")}</span>}
                                  </div>
                                  <p className="text-slate-400 text-[10px] mt-1">{t("dashboard.curriculumMap.tooltip.clickToOpen")}</p>
                                  {/* Arrow */}
                                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                                </div>
                              )}
                            </Link>
                          </div>
                        );
                      })}

                      {/* Empty state for unit with no lessons */}
                      {unit.lessons.length === 0 && (
                        <div className="col-span-full text-center py-6 text-slate-400 text-sm">
                          {t("dashboard.curriculumMap.noLessonsInUnit")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completion banner */}
        {progressPct === 100 && (
          <div className="mt-10 bg-gradient-to-l from-green-500 to-emerald-600 text-white rounded-2xl p-6 text-center shadow-xl">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-xl font-bold">{t("dashboard.curriculumMap.completionBanner.title")}</p>
            <p className="text-green-100 mt-1">{t("dashboard.curriculumMap.completionBanner.subtitle")}</p>
          </div>
        )}

        {/* Quick stats */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{curriculum.units.length}</p>
            <p className="text-xs text-slate-500 mt-1">{t("dashboard.curriculumMap.quickStats.units")}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{totalLessons}</p>
            <p className="text-xs text-slate-500 mt-1">{t("dashboard.curriculumMap.quickStats.totalLessons")}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-2xl font-bold text-green-600">{completedLessons}</p>
            <p className="text-xs text-slate-500 mt-1">{t("dashboard.curriculumMap.quickStats.completedLessons")}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center shadow-sm border border-slate-100 dark:border-slate-700">
            <p className="text-2xl font-bold text-amber-500">
              {curriculum.units.reduce((s, u) => s + u.lessons.filter((l) => l.video_url).length, 0)}
            </p>
            <p className="text-xs text-slate-500 mt-1">{t("dashboard.curriculumMap.quickStats.videoLessons")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

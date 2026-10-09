"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { curriculumAPI, aiAPI } from "@/lib/api";
import toast from "react-hot-toast";
import clsx from "clsx";
import FlashcardDeck from "@/components/lesson/FlashcardDeck";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import LessonVideos from "@/components/video/LessonVideos";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";

type Tab = "explanation" | "summary" | "key-terms" | "questions" | "flashcards" | "video";

export default function LessonsPage() {
  const { id } = useParams<{ id: string }>();
  const { t, dir } = useI18n();
  const { user } = useAuthStore();
  const [structure, setStructure] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<Tab>("explanation");
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [resettingCards, setResettingCards] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isExam = structure?.curriculum?.content_type === "exam";
  // Only the owning teacher (or admin) may edit/delete shared lesson content
  // — students reach this same page to study their teacher's curricula.
  const canManage = user?.role === "teacher" || user?.role === "admin";

  useEffect(() => {
    curriculumAPI.structure(id)
      .then(({ data }) => {
        setStructure(data);
        if (data.curriculum?.content_type === "exam") setActiveTab("questions");
        const first = data.units?.[0]?.lessons?.[0];
        if (first) setActiveLesson(first);
      })
      .catch(() => toast.error(t("dashboard.lessons.loadError")));
  }, [id]);

  useEffect(() => {
    if (!activeLesson) return;
    setContent(null);
    setQuestions([]);
    setFlashcards([]);
    loadTab(activeTab);
  }, [activeLesson]);

  const loadTab = async (tab: Tab) => {
    if (!activeLesson) return;
    setActiveTab(tab);
    setContent(null);
    setLoading(true);
    try {
      if (tab === "explanation") {
        const { data } = await aiAPI.explanation(activeLesson.id);
        setContent(data.explanation);
      } else if (tab === "summary") {
        const { data } = await aiAPI.summary(activeLesson.id);
        setContent(data.summary);
      } else if (tab === "key-terms") {
        const { data } = await aiAPI.keyTerms(activeLesson.id);
        setContent(data.key_terms);
      } else if (tab === "questions") {
        if (isExam) {
          const { data } = await curriculumAPI.lessonQuestions(id, activeLesson.id);
          setQuestions(data.questions ?? []);
        } else {
          const { data } = await aiAPI.generateQuestions(id, {
            lesson_id: activeLesson.id,
            types: ["mcq", "true_false", "why"],
            count: 10,
            difficulty: "medium",
          });
          setQuestions(data.questions);
        }
      } else if (tab === "flashcards") {
        const { data } = await aiAPI.flashcards(activeLesson.id);
        setFlashcards(data.flashcards ?? []);
      } else if (tab === "video") {
        // Video data comes from structure, nothing to fetch
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.lessons.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetFlashcards = async () => {
    setResettingCards(true);
    try {
      await aiAPI.resetFlashcards(activeLesson.id);
      const { data } = await aiAPI.flashcards(activeLesson.id);
      setFlashcards(data.flashcards ?? []);
      toast.success(t("dashboard.lessons.flashcardsRegenerated"));
    } catch {
      toast.error(t("dashboard.lessons.genericError"));
    } finally {
      setResettingCards(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm(t("dashboard.lessons.question.deleteConfirm"))) return;
    try {
      await curriculumAPI.deleteLessonQuestion(id, activeLesson.id, questionId);
      setQuestions((qs) => qs.filter((q) => q.id !== questionId));
      toast.success(t("dashboard.lessons.question.deleteSuccess"));
    } catch {
      toast.error(t("dashboard.lessons.question.deleteError"));
    }
  };

  const tabs: { key: Tab; label: string; icon: string; badge?: string }[] = isExam
    ? [{ key: "questions", label: t("dashboard.lessons.tabs.questions"), icon: "❓" }]
    : [
        { key: "explanation", label: t("dashboard.lessons.tabs.explanation"), icon: "📝" },
        { key: "summary", label: t("dashboard.lessons.tabs.summary"), icon: "✨" },
        { key: "key-terms", label: t("dashboard.lessons.tabs.keyTerms"), icon: "🔑" },
        { key: "flashcards", label: t("dashboard.lessons.tabs.flashcards"), icon: "🃏", badge: t("dashboard.lessons.newBadge") },
        { key: "video", label: t("dashboard.lessons.tabs.video"), icon: "🎬" },
        { key: "questions", label: t("dashboard.lessons.tabs.questions"), icon: "❓" },
      ];

  return (
    <div className="flex gap-5 h-full" dir={dir}>
      {/* Sidebar toggle (mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg lg:hidden"
      >
        📚
      </button>

      {/* Sidebar: Unit/Lesson tree */}
      <div className={clsx(
        "flex-shrink-0 transition-all duration-300",
        sidebarOpen ? "w-72" : "w-0 overflow-hidden"
      )}>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-full">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold text-sm flex items-center gap-2">
            <span>📚</span>
            <span className="truncate">{structure?.curriculum?.title || t("dashboard.lessons.curriculumFallback")}</span>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-12rem)] p-2">
            {structure?.units?.map((unit: any) => (
              <div key={unit.id} className="mb-3">
                {/* Unit header */}
                <div className="flex items-center gap-2 px-2 py-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{unit.title}</span>
                </div>

                {/* Lessons */}
                {unit.lessons.map((lesson: any) => (
                  <button
                    key={lesson.id}
                    onClick={() => setActiveLesson(lesson)}
                    className={clsx(
                      "w-full text-right text-sm px-3 py-2 rounded-lg transition-colors mb-0.5 flex items-center gap-2",
                      activeLesson?.id === lesson.id
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <span className="flex-shrink-0 text-xs">
                      {lesson.has_video ? "🎬" : lesson.has_summary ? "✓" : "○"}
                    </span>
                    <span className="truncate flex-1">{lesson.title}</span>
                    {lesson.has_flashcards && (
                      <span className="flex-shrink-0 text-xs opacity-60">🃏</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {activeLesson ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col h-full">
            {/* Lesson title */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-white">{activeLesson.title}</h2>
                <div className="flex gap-2 mt-1">
                  {activeLesson.has_video && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{t("dashboard.lessons.badges.video")}</span>}
                  {activeLesson.has_flashcards && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{t("dashboard.lessons.badges.flashcards")}</span>}
                  {activeLesson.has_summary && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{t("dashboard.lessons.badges.summary")}</span>}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pt-3 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
              {tabs.map((tItem) => (
                <button
                  key={tItem.key}
                  onClick={() => loadTab(tItem.key)}
                  className={clsx(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap relative flex-shrink-0",
                    activeTab === tItem.key
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                >
                  {tItem.icon} {tItem.label}
                  {tItem.badge && (
                    <span className="absolute -top-1 -left-1 bg-amber-400 text-white text-[9px] px-1 rounded-full">
                      {tItem.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {loading && activeTab !== "video" ? (
                <div className="flex flex-col items-center gap-4 py-16 text-slate-500">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm">
                    {activeTab === "flashcards"
                      ? t("dashboard.lessons.generatingFlashcards")
                      : t("dashboard.lessons.aiWorking")}
                  </p>
                </div>
              ) : activeTab === "key-terms" && content ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(content).map(([term, def]) => (
                    <div key={term} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-100 dark:border-slate-600">
                      <div className="font-bold text-blue-700 dark:text-blue-400 text-sm mb-1.5">📌 {term}</div>
                      <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{def as string}</div>
                    </div>
                  ))}
                </div>
              ) : activeTab === "questions" && questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <QuestionCard
                      key={q.id ?? i}
                      q={q}
                      index={i}
                      onDelete={isExam && canManage && q.id ? () => handleDeleteQuestion(q.id) : undefined}
                    />
                  ))}
                </div>
              ) : activeTab === "questions" && isExam && !loading ? (
                <div className="text-center py-16 text-slate-400">
                  <div className="text-4xl mb-3">❓</div>
                  <p>{t("dashboard.lessons.noExtractedQuestions")}</p>
                </div>
              ) : activeTab === "flashcards" ? (
                flashcards.length > 0 ? (
                  <FlashcardDeck
                    cards={flashcards}
                    onReset={canManage ? handleResetFlashcards : undefined}
                    resetting={resettingCards}
                  />
                ) : !loading ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-4xl mb-3">🃏</div>
                    <p>{t("dashboard.lessons.noFlashcards")}</p>
                  </div>
                ) : null
              ) : activeTab === "video" ? (
                <>
                <LessonVideos
                  curriculumId={id}
                  lesson={activeLesson}
                  unit={structure?.units?.find((u: any) => u.lessons.some((l: any) => l.id === activeLesson.id))}
                  canManage={canManage}
                />
                {(canManage || activeLesson.video_url) && (
                <VideoPlayer
                  key={activeLesson.id}
                  lessonId={activeLesson.id}
                  lessonTitle={activeLesson.title}
                  initialUrl={activeLesson.video_url}
                  initialTitle={activeLesson.video_title}
                  isOwner={canManage}
                  onUpdate={(url, title) => {
                    setActiveLesson((l: any) => ({ ...l, video_url: url, video_title: title, has_video: !!url }));
                  }}
                />
                )}
                </>
              ) : content ? (
                <div className="ai-content text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">
                  {content}
                </div>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-3xl mb-2">👆</div>
                  <p>{t("dashboard.lessons.clickTabPrompt")}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-full flex flex-col items-center justify-center">
            <div className="text-5xl mb-4">👈</div>
            <p className="font-medium">{t("dashboard.lessons.selectLessonPrompt")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Question Card ─── */
function QuestionCard({ q, index, onDelete }: { q: any; index: number; onDelete?: () => void }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="font-mono text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded flex-shrink-0">
          {q.type?.toUpperCase()}
        </span>
        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm flex-1">{q.question}</p>
        {onDelete && (
          <button
            onClick={onDelete}
            title={t("dashboard.lessons.question.delete")}
            className="text-slate-300 hover:text-red-600 dark:text-slate-600 dark:hover:text-red-400 transition-colors text-sm shrink-0"
          >
            🗑️
          </button>
        )}
      </div>

      {q.options && (
        <div className="space-y-2 mb-3">
          {q.options.map((opt: string, i: number) => (
            <div key={i} className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="font-bold text-slate-400 text-xs">
                {["أ", "ب", "ج", "د"][i] ?? i + 1}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setRevealed(!revealed)}
        className="text-xs text-blue-600 hover:underline font-medium"
      >
        {revealed ? t("dashboard.lessons.question.hideAnswer") : t("dashboard.lessons.question.showAnswer")}
      </button>

      {revealed && (
        <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
          <div className="text-sm font-bold text-green-800 dark:text-green-400">
            {t("dashboard.lessons.question.answerLabel")} {q.correct_answer}
          </div>
          {q.explanation && (
            <div className="text-xs text-green-700 dark:text-green-300 mt-1 leading-relaxed">
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

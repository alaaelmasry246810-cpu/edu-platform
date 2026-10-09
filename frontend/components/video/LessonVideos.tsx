"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { videosAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import InteractivePlayer from "./InteractivePlayer";
import VideoStudio from "./VideoStudio";
import VideoEditor from "./VideoEditor";

interface Props {
  curriculumId: string;
  lesson: { id: string; title: string };
  unit?: { id: string; title: string };
  canManage: boolean;
}

const SOURCE_ICON: Record<string, string> = { ai: "🤖", podcast: "🎙️", upload: "📤" };

/** Interactive videos for a lesson (plus its unit's chapter-wide ones). */
export default function LessonVideos({ curriculumId, lesson, unit, canManage }: Props) {
  const { t } = useI18n();
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    videosAPI.list({ lesson_id: lesson.id })
      .then(({ data }) => {
        setVideos(data);
        setSelectedId((cur) => (cur && data.some((v: any) => v.id === cur) ? cur : data.find((v: any) => v.status === "completed")?.id ?? data[0]?.id ?? null));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => { setLoaded(false); setSelectedId(null); setStudioOpen(false); load(); }, [lesson.id]);

  // Poll while something is still being generated.
  const busy = videos.some((v) => v.status === "pending" || v.status === "processing");
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [busy, lesson.id]);

  const selected = videos.find((v) => v.id === selectedId);
  const replace = (v: any) => setVideos((xs) => xs.map((x) => (x.id === v.id ? v : x)));

  if (!loaded) return <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />;

  if (!videos.length && !canManage) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">🎞️ {t("video.list.title")}</h3>
        {canManage && !studioOpen && (
          <button onClick={() => setStudioOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
            + {t("video.list.create")}
          </button>
        )}
      </div>

      {studioOpen && (
        <VideoStudio
          curriculumId={curriculumId}
          lessonId={lesson.id}
          lessonTitle={lesson.title}
          unitId={unit?.id}
          unitTitle={unit?.title}
          onClose={() => setStudioOpen(false)}
          onCreated={(v) => { setVideos((xs) => [v, ...xs]); setSelectedId(v.id); setStudioOpen(false); }}
        />
      )}

      {!videos.length && !studioOpen && (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <div className="text-4xl mb-2">🎞️</div>
          <p className="text-slate-500 text-sm">{t("video.list.empty")}</p>
        </div>
      )}

      {videos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {videos.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedId(v.id)}
              className={clsx(
                "shrink-0 text-start rounded-xl border-2 px-3 py-2 max-w-[16rem]",
                v.id === selectedId ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700",
              )}
            >
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{SOURCE_ICON[v.source]} {v.title}</div>
              <div className="text-[11px] text-slate-500 flex gap-2 mt-0.5">
                <span>{v.scope === "unit" ? t("video.list.unitWide") : t("video.list.lessonOnly")}</span>
                {canManage && (
                  <span className={clsx(
                    v.status === "failed" ? "text-red-500" : v.status !== "completed" ? "text-amber-600" : v.is_published ? "text-green-600" : "text-slate-400",
                  )}>
                    {v.status === "completed" ? (v.is_published ? t("video.status.published") : t("video.status.draft")) : t(`video.status.${v.status}`)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          {selected.status === "completed" ? (
            <InteractivePlayer video={selected} />
          ) : selected.status === "failed" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/20 p-5 text-sm text-red-600">
              ⚠️ {t("video.status.failedMsg")}{selected.error_message ? `: ${selected.error_message}` : ""}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 p-8 text-center">
              <div className="text-4xl mb-3 animate-bounce">{SOURCE_ICON[selected.source]}</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t(`video.status.workingMsg.${selected.source}`)}</p>
            </div>
          )}
          {canManage && (
            <VideoEditor
              video={selected}
              onChange={replace}
              onDeleted={(id) => { setVideos((xs) => xs.filter((x) => x.id !== id)); setSelectedId(null); }}
            />
          )}
        </>
      )}
    </div>
  );
}

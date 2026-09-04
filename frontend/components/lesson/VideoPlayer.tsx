"use client";
import { useState } from "react";
import { aiAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";

interface Props {
  lessonId: string;
  lessonTitle: string;
  initialUrl?: string | null;
  initialTitle?: string | null;
  isOwner?: boolean;
  onUpdate?: (url: string | null, title: string | null) => void;
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/"))
      return u.pathname.split("/embed/")[1].split("?")[0];
  } catch {}
  return null;
}

export default function VideoPlayer({
  lessonId, lessonTitle, initialUrl, initialTitle, isOwner, onUpdate,
}: Props) {
  const { t, locale } = useI18n();
  const [videoUrl, setVideoUrl] = useState(initialUrl ?? "");
  const [videoTitle, setVideoTitle] = useState(initialTitle ?? "");
  const [editMode, setEditMode] = useState(false);
  const [inputUrl, setInputUrl] = useState(initialUrl ?? "");
  const [inputTitle, setInputTitle] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState(false);

  const youtubeId = videoUrl ? extractYoutubeId(videoUrl) : null;
  const isYoutube = !!youtubeId;

  const tips = dictionaries[locale].dashboard.videoPlayer.tips;
  const tipIcons = ["📝", "⏸️", "🔁"];

  const saveVideo = async () => {
    if (!inputUrl.trim()) return toast.error(t("dashboard.videoPlayer.urlRequired"));
    setSaving(true);
    try {
      await aiAPI.updateVideo(lessonId, { video_url: inputUrl.trim(), video_title: inputTitle.trim() || undefined });
      setVideoUrl(inputUrl.trim());
      setVideoTitle(inputTitle.trim());
      setEditMode(false);
      onUpdate?.(inputUrl.trim(), inputTitle.trim() || null);
      toast.success(t("dashboard.videoPlayer.saved"));
    } catch {
      toast.error(t("dashboard.videoPlayer.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const removeVideo = async () => {
    if (!confirm(t("dashboard.videoPlayer.confirmDelete"))) return;
    try {
      await aiAPI.removeVideo(lessonId);
      setVideoUrl(""); setVideoTitle(""); setInputUrl(""); setInputTitle("");
      onUpdate?.(null, null);
      toast.success(t("dashboard.videoPlayer.removed"));
    } catch {
      toast.error(t("dashboard.videoPlayer.removeError"));
    }
  };

  /* ─── No video yet ─── */
  if (!videoUrl) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
        <div className="text-5xl mb-3">🎬</div>
        <p className="text-slate-500 font-medium mb-1">{t("dashboard.videoPlayer.noVideoYet")}</p>
        {isOwner ? (
          <>
            <p className="text-slate-400 text-sm mb-4">{t("dashboard.videoPlayer.ownerHint")}</p>
            <button
              onClick={() => setEditMode(true)}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {t("dashboard.videoPlayer.addVideo")}
            </button>
          </>
        ) : (
          <p className="text-slate-400 text-sm">{t("dashboard.videoPlayer.noVideoStudent")}</p>
        )}

        {editMode && isOwner && (
          <div className="mt-6 max-w-md mx-auto text-right space-y-3">
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder={t("dashboard.videoPlayer.urlPlaceholder")}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
              placeholder={t("dashboard.videoPlayer.titlePlaceholder")}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={saveVideo} disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? t("dashboard.videoPlayer.saving") : t("dashboard.videoPlayer.save")}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2.5 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                {t("dashboard.videoPlayer.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Has video ─── */
  return (
    <div>
      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
          🎬 {videoTitle || lessonTitle}
        </h3>
        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditMode(!editMode); setInputUrl(videoUrl); setInputTitle(videoTitle); }}
              className="text-xs text-blue-500 hover:underline"
            >
              {t("dashboard.videoPlayer.edit")}
            </button>
            <button onClick={removeVideo} className="text-xs text-red-400 hover:underline">{t("dashboard.videoPlayer.delete")}</button>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editMode && isOwner && (
        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-2">
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder={t("dashboard.videoPlayer.urlPlaceholder")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={inputTitle}
            onChange={(e) => setInputTitle(e.target.value)}
            placeholder={t("dashboard.videoPlayer.titlePlaceholderShort")}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button onClick={saveVideo} disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
              {saving ? "..." : t("dashboard.videoPlayer.save")}
            </button>
            <button onClick={() => setEditMode(false)}
              className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50">
              {t("dashboard.videoPlayer.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Video embed */}
      {isYoutube ? (
        <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            title={videoTitle || lessonTitle}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        /* Generic video player */
        <div className="rounded-2xl overflow-hidden shadow-lg bg-black">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-96"
            title={videoTitle || lessonTitle}
          />
        </div>
      )}

      {/* Tips */}
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {tips.map((tipText, i) => (
          <div key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
            <span className="text-lg">{tipIcons[i]}</span>
            <p className="text-xs text-slate-600 dark:text-slate-300">{tipText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

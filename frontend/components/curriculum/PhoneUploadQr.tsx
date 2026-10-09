"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Smartphone, X } from "lucide-react";
import { curriculumAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const SESSION_MINUTES = 10;

export default function PhoneUploadQr({ onReceived }: { onReceived: (curriculum: any) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_MINUTES * 60);
  const startedAtRef = useRef<number>(0);

  const startSession = async () => {
    try {
      const { data } = await curriculumAPI.createUploadSession();
      startedAtRef.current = Date.now();
      setUrl(`${window.location.origin}/m/upload?token=${encodeURIComponent(data.token)}`);
      setSecondsLeft(data.expires_in || SESSION_MINUTES * 60);
      setOpen(true);
    } catch {
      toast.error(t("dashboard.upload.phoneUpload.startError"));
    }
  };

  useEffect(() => {
    if (!open || !url) return;

    const countdown = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);

    const poll = setInterval(async () => {
      try {
        const { data } = await curriculumAPI.list();
        const found = (data || []).find(
          (c: any) => new Date(c.created_at).getTime() > startedAtRef.current
        );
        if (found) {
          clearInterval(poll);
          clearInterval(countdown);
          setOpen(false);
          toast.success(t("dashboard.upload.phoneUpload.received"));
          onReceived(found);
        }
      } catch {
        // ignore transient poll errors
      }
    }, 4000);

    return () => {
      clearInterval(poll);
      clearInterval(countdown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  useEffect(() => {
    if (secondsLeft === 0) setOpen(false);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <>
      <button
        type="button"
        onClick={startSession}
        className="w-full flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 rounded-xl py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Smartphone size={18} />
        {t("dashboard.upload.phoneUpload.button")}
      </button>

      {open && url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 end-3 text-slate-400 hover:text-slate-600"
              aria-label="close"
            >
              <X size={18} />
            </button>
            <h3 className="font-bold text-lg mb-1">{t("dashboard.upload.phoneUpload.title")}</h3>
            <p className="text-slate-500 text-sm mb-4">{t("dashboard.upload.phoneUpload.hint")}</p>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <QRCodeSVG value={url} size={200} />
              </div>
            </div>
            <p className="text-slate-400 text-xs mb-2">
              {t("dashboard.upload.phoneUpload.expiresIn", { minutes: `${minutes}:${seconds}` })}
            </p>
            <p className="text-blue-600 text-sm animate-pulse">{t("dashboard.upload.phoneUpload.waiting")}</p>
          </div>
        </div>
      )}
    </>
  );
}

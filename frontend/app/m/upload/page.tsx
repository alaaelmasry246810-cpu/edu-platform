"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { UploadCloud, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function MobileUploadPage() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<"curriculum" | "exam">("curriculum");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!file) return toast.error(t("dashboard.upload.errors.noFile"));

    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title || file.name);
    fd.append("content_type", contentType);

    try {
      await api.post("/curricula/upload", fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDone(true);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setExpired(true);
      } else {
        toast.error(err.response?.data?.detail || t("dashboard.upload.errors.uploadFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-slate-500">{t("mobileUpload.missingToken")}</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-slate-500">{t("mobileUpload.expiredToken")}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
        <CheckCircle2 size={56} className="text-green-500" />
        <p className="font-semibold text-lg">{t("mobileUpload.success")}</p>
        <p className="text-slate-500 text-sm">{t("mobileUpload.successHint")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-1">{t("mobileUpload.title")}</h1>
          <p className="text-slate-500 text-sm">{t("mobileUpload.subtitle")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["curriculum", "exam"] as const).map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => setContentType(ct)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                contentType === ct
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              {t(`dashboard.upload.contentType.${ct}`)}
            </button>
          ))}
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            capture="environment"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div className="font-semibold text-slate-800 break-all">{file.name}</div>
          ) : (
            <div>
              <UploadCloud className="mx-auto mb-2 text-slate-400" size={32} />
              <div className="font-semibold text-slate-700">{t("dashboard.upload.dropzone.hint")}</div>
            </div>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("dashboard.upload.fields.titlePlaceholder")}
          className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl disabled:opacity-60 text-sm"
        >
          {loading ? t("mobileUpload.submitting") : t("mobileUpload.submit")}
        </button>
      </form>
    </div>
  );
}

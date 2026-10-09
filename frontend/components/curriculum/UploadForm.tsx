"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { curriculumAPI, assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import PhoneUploadQr from "./PhoneUploadQr";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";

export default function UploadForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", subject: "", grade_level: "" });
  const [contentType, setContentType] = useState<"curriculum" | "exam">("curriculum");
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isTeacher) assignmentAPI.listGroups().then(({ data }) => setGroups(data)).catch(() => {});
  }, [isTeacher]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error(t("dashboard.upload.errors.noFile"));
    if (!form.title) return toast.error(t("dashboard.upload.errors.noTitle"));

    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", form.title);
    fd.append("content_type", contentType);
    if (form.subject) fd.append("subject", form.subject);
    if (form.grade_level) fd.append("grade_level", form.grade_level);
    if (groupId) fd.append("group_id", groupId);

    try {
      await curriculumAPI.upload(fd);
      toast.success(t("dashboard.upload.success"));
      router.push(redirectTo);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("dashboard.upload.errors.uploadFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{t("dashboard.upload.title")}</h1>
      <p className="text-slate-500 text-sm mb-8">
        {t("dashboard.upload.subtitle")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content type */}
        <div className="grid grid-cols-2 gap-3">
          {(["curriculum", "exam"] as const).map((ct) => (
            <button
              key={ct}
              type="button"
              onClick={() => setContentType(ct)}
              className={`rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                contentType === ct
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-300"
              }`}
            >
              {t(`dashboard.upload.contentType.${ct}`)}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
            ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400"}`}
        >
          <input ref={fileRef} type="file" accept={ACCEPTED} hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div>
              <div className="text-3xl mb-2">📄</div>
              <div className="font-semibold text-slate-800">{file.name}</div>
              <div className="text-slate-500 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          ) : (
            <div>
              <div className="text-4xl mb-3">⬆️</div>
              <div className="font-semibold text-slate-700">{t("dashboard.upload.dropzone.hint")}</div>
              <div className="text-slate-400 text-sm mt-1">{t("dashboard.upload.dropzone.formats")}</div>
            </div>
          )}
        </div>

        <PhoneUploadQr
          onReceived={() => {
            router.push(redirectTo);
          }}
        />

        {/* Metadata */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("dashboard.upload.fields.title")}</label>
            <input
              required value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t("dashboard.upload.fields.titlePlaceholder")}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("dashboard.upload.fields.subject")}</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder={t("dashboard.upload.fields.subjectPlaceholder")}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("dashboard.upload.fields.grade")}</label>
              <input
                value={form.grade_level}
                onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                placeholder={t("dashboard.upload.fields.gradePlaceholder")}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {isTeacher && groups.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("dashboard.upload.fields.group")}</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t("dashboard.upload.fields.groupPlaceholder")}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <button
          type="submit" disabled={loading || !file}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors disabled:opacity-60 text-sm"
        >
          {loading ? t("dashboard.upload.submitting") : t("dashboard.upload.submit")}
        </button>
      </form>
    </div>
  );
}

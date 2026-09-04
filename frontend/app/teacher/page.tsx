"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherAPI, authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import toast from "react-hot-toast";
import { useI18n } from "@/lib/i18n";

export default function TeacherDashboard() {
  const { t, dir, locale } = useI18n();
  const { user, updateUser } = useAuthStore();
  const [students, setStudents] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const canAddChannelLinks = user?.role === "admin" ||
    (user as any)?.teacher_features?.can_add_channel_links === true;
  const [links, setLinks] = useState<{ label: string; url: string }[]>(user?.channel_links || []);
  const [savingLinks, setSavingLinks] = useState(false);

  const addLinkRow = () => setLinks(prev => [...prev, { label: "", url: "" }]);
  const removeLinkRow = (idx: number) => setLinks(prev => prev.filter((_, i) => i !== idx));
  const updateLinkRow = (idx: number, field: "label" | "url", value: string) =>
    setLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const saveLinks = async () => {
    setSavingLinks(true);
    try {
      const cleaned = links.filter(l => l.label.trim() && l.url.trim());
      const { data } = await teacherAPI.updateChannelLinks(cleaned);
      setLinks(data.channel_links || []);
      updateUser({ channel_links: data.channel_links || [] });
      toast.success(t("teacher.home.channelLinks.saveSuccess"));
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacher.home.channelLinks.saveError"));
    } finally {
      setSavingLinks(false);
    }
  };

  useEffect(() => {
    Promise.all([
      teacherAPI.students(),
      teacherAPI.pending(),
      authAPI.teacherCode(),
    ])
      .then(([s, p, c]) => {
        setStudents(s.data);
        setPending(p.data);
        setCode(c.data.teacher_code || "");
      })
      .catch(() => toast.error(t("teacher.home.loadError")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const examTypeLabel = (type: string) =>
    ({
      lesson_practice: t("teacher.examTypes.lessonPractice"),
      unit_practice: t("teacher.examTypes.unitPractice"),
      comprehensive: t("teacher.examTypes.comprehensive"),
    } as Record<string, string>)[type] ?? type;

  return (
    <div dir={dir}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("teacher.home.welcome")}</h1>

      {/* Teacher code */}
      {code && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">{t("teacher.home.codeLabel")}</p>
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-black text-blue-800 dark:text-blue-200 tracking-widest">{code}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(code); toast.success(t("teacher.home.copied")); }}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              {t("teacher.home.copy")}
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-3">
        {[
          { label: t("teacher.home.stats.totalStudents"), value: students.length, color: "text-blue-700 dark:text-blue-400", link: "/teacher/students" },
          { label: t("teacher.home.stats.needsReview"), value: pending.length, color: "text-amber-700 dark:text-amber-400", link: "/teacher/pending" },
          { label: t("teacher.home.stats.activeStudents"), value: students.filter(s => s.status === "active").length, color: "text-green-700 dark:text-green-400", link: "/teacher/students" },
        ].map(s => (
          <Link
            key={s.label}
            href={s.link}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-shadow"
          >
            <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Pending items preview */}
      {pending.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">{t("teacher.home.needsReviewSection")}</h2>
            <Link href="/teacher/pending" className="text-xs text-blue-600 hover:underline">{t("teacher.home.viewAll")}</Link>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 4).map((a: any) => (
              <Link
                key={a.attempt_id}
                href={`/teacher/pending/${a.attempt_id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <span className="text-lg">{a.needs_manual ? "✍️" : "📋"}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{a.student_name}</div>
                  <div className="text-xs text-slate-400">{examTypeLabel(a.exam_type)}</div>
                </div>
                <div className="text-xs text-slate-400">
                  {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US") : "—"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Channel links (gated by admin-granted feature flag) */}
      {canAddChannelLinks && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 mt-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-slate-800 dark:text-slate-100">{t("teacher.home.channelLinks.title")}</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">{t("teacher.home.channelLinks.subtitle")}</p>

          <div className="space-y-3 mb-4">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t("teacher.home.channelLinks.labelPlaceholder")}
                  value={link.label}
                  onChange={e => updateLinkRow(idx, "label", e.target.value)}
                  className="w-40 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="url"
                  placeholder={t("teacher.home.channelLinks.urlPlaceholder")}
                  value={link.url}
                  onChange={e => updateLinkRow(idx, "url", e.target.value)}
                  className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => removeLinkRow(idx)} className="text-red-500 hover:text-red-700 px-2 text-sm">✕</button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={addLinkRow} className="text-sm text-blue-600 hover:underline">{t("teacher.home.channelLinks.addRow")}</button>
            <button
              onClick={saveLinks}
              disabled={savingLinks}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium ms-auto"
            >
              {savingLinks ? t("teacher.home.channelLinks.saving") : t("teacher.home.channelLinks.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

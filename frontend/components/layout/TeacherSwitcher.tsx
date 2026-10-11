"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { authAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface MyTeacher { id: string; full_name: string; student_code: string | null; active: boolean }

/** Student sidebar: which teacher's curricula/assignments/activities they see,
 *  and joining another teacher with their code. */
export default function TeacherSwitcher() {
  const { t } = useI18n();
  const [teachers, setTeachers] = useState<MyTeacher[]>([]);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authAPI.myTeachers().then(({ data }) => setTeachers(data)).catch(() => {});
  }, []);

  // Everything on the page belongs to the active teacher — reload to show the new one's.
  const reload = () => window.location.reload();

  const switchTo = async (id: string) => {
    setBusy(true);
    try {
      await authAPI.activateTeacher(id);
      reload();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacherSwitcher.error"));
      setBusy(false);
    }
  };

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data } = await authAPI.joinTeacher(code.trim());
      toast.success(data.already ? t("teacherSwitcher.already", { name: data.full_name }) : t("teacherSwitcher.joined", { name: data.full_name }));
      reload();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || t("teacherSwitcher.error"));
      setBusy(false);
    }
  };

  const active = teachers.find((x) => x.active);

  return (
    <div className="mt-2 space-y-1.5">
      {teachers.length > 1 ? (
        <label className="block text-xs text-slate-500">
          {t("teacherSwitcher.label")}
          <select
            value={active?.id || ""}
            disabled={busy}
            onChange={(e) => switchTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-200"
          >
            {!active && <option value="">—</option>}
            {teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
          </select>
        </label>
      ) : active ? (
        <div className="text-xs text-slate-500">{t("teacherSwitcher.label")}: <span className="font-medium text-slate-700 dark:text-slate-300">{active.full_name}</span></div>
      ) : null}

      {adding ? (
        <div className="flex gap-1">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder={t("teacherSwitcher.codePlaceholder")}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono"
          />
          <button onClick={join} disabled={busy || !code.trim()} className="rounded-lg bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50">
            {t("teacherSwitcher.join")}
          </button>
          <button onClick={() => { setAdding(false); setCode(""); }} className="px-1 text-xs text-slate-400">✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
          + {t("teacherSwitcher.add")}
        </button>
      )}
    </div>
  );
}

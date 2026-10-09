"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import StudentPicker from "@/components/teacher/StudentPicker";

interface Group {
  id: string;
  name: string;
  student_ids: string[];
}

export default function GroupsPage() {
  const { t, dir } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    assignmentAPI.listGroups().then(({ data }) => setGroups(data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!name.trim()) return toast.error(t("teacher.groups.nameRequired"));
    if (selected.length === 0) return toast.error(t("teacher.groups.studentsRequired"));
    setSaving(true);
    try {
      await assignmentAPI.createGroup({ name, student_ids: selected });
      toast.success(t("teacher.groups.createSuccess"));
      setName("");
      setSelected([]);
      setCreating(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.groups.createError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("teacher.groups.deleteConfirm"))) return;
    try {
      await assignmentAPI.deleteGroup(id);
      toast.success(t("teacher.groups.deleteSuccess"));
      load();
    } catch {
      toast.error(t("teacher.groups.deleteError"));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("teacher.groups.title")} 👥</h1>
          <p className="text-slate-500 text-sm mt-1">{t("teacher.groups.subtitle")}</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {creating ? t("teacher.groups.cancel") : t("teacher.groups.newGroup")}
        </button>
      </div>

      {creating && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("teacher.groups.namePlaceholder")}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
          />
          <StudentPicker selected={selected} onChange={setSelected} />
          <button
            onClick={handleCreate}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60"
          >
            {saving ? t("teacher.groups.saving") : t("teacher.groups.save")}
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          {t("teacher.groups.empty")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">{g.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t("teacher.groups.memberCount", { n: g.student_ids.length })}</div>
              </div>
              <button onClick={() => handleDelete(g.id)} className="text-red-500 hover:text-red-700 text-sm">
                {t("teacher.groups.delete")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

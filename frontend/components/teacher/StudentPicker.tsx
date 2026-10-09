"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { teacherAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Student {
  id: string;
  full_name: string;
  student_code: string | null;
}

export default function StudentPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teacherAPI.students()
      .then(({ data }) => setStudents(data))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  if (loading) {
    return <div className="text-sm text-slate-400 py-4">{t("teacher.assignments.picker.loading")}</div>;
  }

  if (students.length === 0) {
    return <div className="text-sm text-slate-400 py-4">{t("teacher.assignments.picker.empty")}</div>;
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
      {students.map((s) => {
        const checked = selected.includes(s.id);
        return (
          <label
            key={s.id}
            className={clsx(
              "flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors",
              checked ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
          >
            <input type="checkbox" checked={checked} onChange={() => toggle(s.id)} className="w-4 h-4" />
            <span className="flex-1 text-slate-700 dark:text-slate-300">{s.full_name}</span>
            {s.student_code && <span className="text-xs text-slate-400">{s.student_code}</span>}
          </label>
        );
      })}
    </div>
  );
}

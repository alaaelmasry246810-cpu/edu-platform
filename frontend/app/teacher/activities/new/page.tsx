"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ActivityEditor } from "@/components/activities/TeacherPanels";

export default function NewActivity() {
  const { t } = useI18n();
  const router = useRouter();
  // ?curriculum=…&lesson=… when started from a lesson page
  const [ctx, setCtx] = useState<{ curriculum?: string; lesson?: string } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setCtx({ curriculum: p.get("curriculum") ?? undefined, lesson: p.get("lesson") ?? undefined });
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">✨ {t("games.list.create")}</h1>
      {ctx && (
        <ActivityEditor
          initialCurriculumId={ctx.curriculum}
          initialLessonId={ctx.lesson}
          onSaved={(a) => router.replace(`/teacher/activities/${a.id}`)}
        />
      )}
    </div>
  );
}

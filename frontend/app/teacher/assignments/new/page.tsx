"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import clsx from "clsx";
import { assignmentAPI, curriculumAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import StudentPicker from "@/components/teacher/StudentPicker";

type Kind = "exam" | "practice";
type ExamType = "lesson_practice" | "unit_practice" | "comprehensive";
type TargetMode = "students" | "group";

const KIND_DEFAULTS: Record<Kind, { allow_multiple_attempts: boolean; auto_reveal_score: boolean }> = {
  exam: { allow_multiple_attempts: false, auto_reveal_score: false },
  practice: { allow_multiple_attempts: true, auto_reveal_score: true },
};

export default function NewAssignmentPage() {
  const { t, dir } = useI18n();
  const router = useRouter();

  const [kind, setKind] = useState<Kind>("practice");
  const [title, setTitle] = useState("");
  const [curricula, setCurricula] = useState<any[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [examType, setExamType] = useState<ExamType>("comprehensive");

  const [units, setUnits] = useState<any[]>([]);
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");

  const [allAssignments, setAllAssignments] = useState<any[]>([]);

  const [targetMode, setTargetMode] = useState<TargetMode>("students");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState("");

  const [availableFrom, setAvailableFrom] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(KIND_DEFAULTS.practice.allow_multiple_attempts);
  const [autoReveal, setAutoReveal] = useState(KIND_DEFAULTS.practice.auto_reveal_score);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    curriculumAPI.list().then(({ data }) => setCurricula(data.filter((c: any) => c.status === "completed")));
    assignmentAPI.listGroups().then(({ data }) => setGroups(data));
    assignmentAPI.list().then(({ data }) => setAllAssignments(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setUnitId("");
    setLessonId("");
    if (!curriculumId) { setUnits([]); return; }
    curriculumAPI.structure(curriculumId).then(({ data }) => setUnits(data.units || [])).catch(() => setUnits([]));
  }, [curriculumId]);

  const existingForCurriculum = curriculumId ? allAssignments.filter((a) => a.curriculum_id === curriculumId) : [];
  const selectedUnit = units.find((u) => u.id === unitId);

  const selectKind = (k: Kind) => {
    setKind(k);
    setAllowMultiple(KIND_DEFAULTS[k].allow_multiple_attempts);
    setAutoReveal(KIND_DEFAULTS[k].auto_reveal_score);
  };

  const selectExamType = (et: ExamType) => {
    setExamType(et);
    if (et !== "unit_practice") setUnitId("");
    if (et !== "lesson_practice") setLessonId("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error(t("teacher.assignments.form.titleRequired"));
    if (!curriculumId) return toast.error(t("teacher.assignments.form.curriculumRequired"));
    if (examType === "unit_practice" && !unitId) return toast.error(t("teacher.assignments.form.scopeRequired"));
    if (examType === "lesson_practice" && !lessonId) return toast.error(t("teacher.assignments.form.scopeRequired"));
    if (targetMode === "students" && studentIds.length === 0) return toast.error(t("teacher.assignments.form.targetsRequired"));
    if (targetMode === "group" && !groupId) return toast.error(t("teacher.assignments.form.targetsRequired"));

    setSaving(true);
    try {
      await assignmentAPI.create({
        kind,
        title,
        curriculum_id: curriculumId,
        exam_type: examType,
        unit_id: examType === "unit_practice" ? unitId : null,
        lesson_id: examType === "lesson_practice" ? lessonId : null,
        student_ids: targetMode === "students" ? studentIds : [],
        group_id: targetMode === "group" ? groupId : null,
        available_from: availableFrom || null,
        due_at: dueAt || null,
        time_limit_minutes: timeLimitMinutes ? parseInt(timeLimitMinutes, 10) : null,
        allow_multiple_attempts: allowMultiple,
        auto_reveal_score: autoReveal,
      });
      toast.success(t("teacher.assignments.form.createSuccess"));
      router.push("/teacher/assignments");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("teacher.assignments.form.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto" dir={dir}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t("teacher.assignments.form.title")}</h1>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-5">
        {/* Kind */}
        <div className="grid grid-cols-2 gap-3">
          {(["practice", "exam"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => selectKind(k)}
              className={clsx(
                "rounded-xl border-2 py-3 text-sm font-semibold",
                kind === k ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "border-slate-200 dark:border-slate-700 text-slate-500"
              )}
            >
              {k === "practice" ? t("teacher.assignments.kindPractice") : t("teacher.assignments.kindExam")}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.titleLabel")}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("teacher.assignments.form.titlePlaceholder")}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
          />
        </div>

        {/* Curriculum */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.curriculumLabel")}</label>
          <select
            value={curriculumId}
            onChange={(e) => setCurriculumId(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
          >
            <option value="">{t("teacher.assignments.form.curriculumPlaceholder")}</option>
            {curricula.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {/* Existing assignments/exams already on this curriculum, so the
            teacher can see what's there before creating another one. */}
        {curriculumId && existingForCurriculum.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              {t("teacher.assignments.form.existingTitle", { n: existingForCurriculum.length })}
            </div>
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {existingForCurriculum.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="truncate">
                    {a.kind === "practice" ? t("teacher.assignments.kindPractice") : t("teacher.assignments.kindExam")} · {a.title}
                  </span>
                  <span className="text-slate-400 shrink-0 ms-2">{t("teacher.assignments.completionCount", { done: a.submitted_count, total: a.target_count })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Exam type */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.examTypeLabel")}</label>
          <select
            value={examType}
            onChange={(e) => selectExamType(e.target.value as ExamType)}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
          >
            <option value="lesson_practice">{t("dashboard.exam.setup.types.lesson_practice")}</option>
            <option value="unit_practice">{t("dashboard.exam.setup.types.unit_practice")}</option>
            <option value="comprehensive">{t("dashboard.exam.setup.types.comprehensive")}</option>
          </select>
        </div>

        {/* Unit / lesson scope — only when the exam type narrows to one */}
        {examType === "unit_practice" && (
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.unitLabel")}</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
            >
              <option value="">{t("teacher.assignments.form.unitPlaceholder")}</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
        )}

        {examType === "lesson_practice" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.unitLabel")}</label>
              <select
                value={unitId}
                onChange={(e) => { setUnitId(e.target.value); setLessonId(""); }}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
              >
                <option value="">{t("teacher.assignments.form.unitPlaceholder")}</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.lessonLabel")}</label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                disabled={!unitId}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700 disabled:opacity-50"
              >
                <option value="">{t("teacher.assignments.form.lessonPlaceholder")}</option>
                {(selectedUnit?.lessons || []).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Targets */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.targetsLabel")}</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setTargetMode("students")}
              className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium", targetMode === "students" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500")}
            >
              {t("teacher.assignments.form.pickStudents")}
            </button>
            <button
              type="button"
              onClick={() => setTargetMode("group")}
              className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium", targetMode === "group" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500")}
            >
              {t("teacher.assignments.form.pickGroup")}
            </button>
          </div>
          {targetMode === "students" ? (
            <StudentPicker selected={studentIds} onChange={setStudentIds} />
          ) : (
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
            >
              <option value="">{t("teacher.assignments.form.groupPlaceholder")}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.student_ids.length})</option>)}
            </select>
          )}
        </div>

        {/* Time limit — overrides the curriculum's default duration for this exam type, just for this assignment */}
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            {t("teacher.assignments.form.timeLimitLabel")}
            <span className="text-slate-400 font-normal"> {t("teacher.assignments.form.timeLimitHint")}</span>
          </label>
          <input
            type="number" min={1} max={300}
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(e.target.value)}
            placeholder={t("teacher.assignments.form.timeLimitPlaceholder")}
            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-sm bg-white dark:bg-slate-700"
          />
        </div>

        {/* Scheduling */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.availableFrom")}</label>
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">{t("teacher.assignments.form.dueAt")}</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-700"
            />
          </div>
        </div>

        {/* Behavior toggles */}
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
          <label className="flex items-center justify-between text-sm">
            <span>{t("teacher.assignments.form.allowMultiple")}</span>
            <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="w-4 h-4" />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("teacher.assignments.form.autoReveal")}</span>
            <input type="checkbox" checked={autoReveal} onChange={(e) => setAutoReveal(e.target.checked)} className="w-4 h-4" />
          </label>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-60 text-sm"
        >
          {saving ? t("teacher.assignments.form.creating") : t("teacher.assignments.form.submit")}
        </button>
      </div>
    </div>
  );
}

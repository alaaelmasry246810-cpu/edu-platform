"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { assignmentAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import ActiveExam from "@/components/exam/ActiveExam";
import ExamResults from "@/components/exam/ExamResults";
import type { ExamData, ExamResult } from "@/components/exam/types";

export default function TakeAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, dir } = useI18n();
  const [phase, setPhase] = useState<"loading" | "active" | "results" | "error">("loading");
  const [exam, setExam] = useState<ExamData | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    assignmentAPI.start(id)
      .then(({ data }) => { setExam(data); setPhase("active"); })
      .catch((err) => {
        setErrorMsg(err.response?.data?.detail || t("dashboard.assignments.startError"));
        setPhase("error");
      });
  }, [id]);

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4" dir={dir}>
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">{t("dashboard.exam.generating")}</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto text-center py-16" dir={dir}>
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-slate-600 dark:text-slate-300 mb-4">{errorMsg}</p>
        <button onClick={() => router.push("/dashboard/assignments")} className="text-blue-600 hover:underline text-sm">
          {t("dashboard.assignments.backToList")}
        </button>
      </div>
    );
  }

  if (phase === "active" && exam) {
    return <ActiveExam exam={exam} onSubmit={(r) => { setResult(r); setPhase("results"); toast.success(t("dashboard.assignments.submitted")); }} />;
  }

  if (phase === "results" && result) {
    return (
      <ExamResults
        result={result}
        onRetry={() => router.push("/dashboard/assignments")}
        retryLabel={t("dashboard.assignments.backToList")}
      />
    );
  }

  return null;
}

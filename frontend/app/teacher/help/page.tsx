"use client";
import { useI18n } from "@/lib/i18n";
import GuideView from "@/components/help/GuideView";
import { getTeacherGuide } from "@/lib/guides/teacherGuide";

export default function TeacherHelpPage() {
  const { locale } = useI18n();
  const { title, subtitle, sections } = getTeacherGuide(locale);
  return <GuideView title={title} subtitle={subtitle} sections={sections} />;
}

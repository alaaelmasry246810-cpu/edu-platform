"use client";
import { useI18n } from "@/lib/i18n";
import GuideView from "@/components/help/GuideView";
import { getStudentGuide } from "@/lib/guides/studentGuide";

export default function StudentHelpPage() {
  const { locale } = useI18n();
  const { title, subtitle, sections } = getStudentGuide(locale);
  return <GuideView title={title} subtitle={subtitle} sections={sections} />;
}

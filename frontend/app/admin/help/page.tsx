"use client";
import { useI18n } from "@/lib/i18n";
import GuideView from "@/components/help/GuideView";
import { getAdminGuide } from "@/lib/guides/adminGuide";

export default function AdminHelpPage() {
  const { locale } = useI18n();
  const { title, subtitle, sections } = getAdminGuide(locale);
  return <GuideView title={title} subtitle={subtitle} sections={sections} />;
}

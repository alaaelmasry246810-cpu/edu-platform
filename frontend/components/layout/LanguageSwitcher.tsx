"use client";
import { useI18n } from "@/lib/i18n";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, toggleLocale } = useI18n();

  return (
    <button
      onClick={toggleLocale}
      title={locale === "ar" ? "Switch to English" : "التبديل للعربية"}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${className}`}
    >
      {locale === "ar" ? "EN" : "AR"}
    </button>
  );
}

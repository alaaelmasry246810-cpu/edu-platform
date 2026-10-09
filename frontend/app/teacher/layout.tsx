"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { t, dir } = useI18n();

  const NAV = [
    { href: "/teacher",              label: t("nav.teacherHome"),       icon: "🏠" },
    { href: "/teacher/students",     label: t("nav.myStudents"),        icon: "👥" },
    { href: "/teacher/groups",       label: t("nav.myGroups"),          icon: "🧑‍🤝‍🧑" },
    { href: "/teacher/assignments",  label: t("nav.assignments"),       icon: "📝" },
    { href: "/teacher/activities",   label: t("nav.games"),             icon: "🎮" },
    { href: "/teacher/pending",      label: t("nav.needsReview"),       icon: "📋" },
    { href: "/teacher/curricula",    label: t("nav.manageMyCurricula"), icon: "📚" },
    { href: "/teacher/question-bank", label: t("nav.questionBank"),     icon: "🗂️" },
    { href: "/teacher/exam-configs", label: t("nav.examConfigs"),       icon: "⚙️" },
    { href: "/teacher/help",         label: t("nav.guide"),             icon: "📘" },
  ];

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  useEffect(() => {
    if (user && user.role !== "teacher" && user.role !== "admin") {
      router.push("/dashboard");
    } else if (user?.must_change_password) {
      router.push("/auth/change-password");
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir={dir}>
      {/* Top bar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-slate-800 dark:text-white">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <span className="text-sm text-slate-500">{user?.full_name}</span>
          <Link href="/auth/change-password" className="text-xs text-slate-500 hover:text-blue-600 transition-colors">
            🔒 {t("sidebar.changePassword")}
          </Link>
          <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-red-600 transition-colors">
            {t("sidebar.logout")} →
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-3 flex-shrink-0 hidden md:block">
          <nav className="space-y-1">
            {NAV.map(n => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  pathname === n.href
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                )}
              >
                <span>{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import clsx from "clsx";
import NotificationBell from "@/components/layout/NotificationBell";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import TeacherSwitcher from "@/components/layout/TeacherSwitcher";
import { useI18n } from "@/lib/i18n";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuthStore();
  const { t, dir } = useI18n();

  const studentNav = [
    { href: "/dashboard",            label: t("nav.myCurricula"),       icon: "📚" },
    { href: "/dashboard/upload",     label: t("nav.uploadCurriculum"),  icon: "⬆️" },
    { href: "/dashboard/schedule",   label: t("nav.schedule"),          icon: "📅" },
    { href: "/dashboard/exam",       label: t("nav.exams"),             icon: "✏️" },
    { href: "/dashboard/assignments", label: t("nav.myAssignments"),    icon: "📝" },
    { href: "/dashboard/activities", label: t("nav.games"),             icon: "🎮" },
    { href: "/dashboard/grades",     label: t("nav.grades"),            icon: "📊" },
    { href: "/dashboard/progress",   label: t("nav.progress"),          icon: "📈" },
    { href: "/dashboard/summary",    label: t("nav.glossary"),          icon: "📖" },
    { href: "/dashboard/pricing",    label: t("nav.plans"),             icon: "💳" },
    { href: "/dashboard/help",       label: t("nav.guide"),             icon: "📘" },
  ];

  const teacherNav = [
    { href: "/teacher",                   label: t("nav.teacherHome"),   icon: "🏠" },
    { href: "/teacher/students",          label: t("nav.myStudents"),    icon: "👥" },
    { href: "/teacher/groups",            label: t("nav.myGroups"),      icon: "🧑‍🤝‍🧑" },
    { href: "/teacher/assignments",       label: t("nav.assignments"),   icon: "📝" },
    { href: "/teacher/activities",        label: t("nav.games"),         icon: "🎮" },
    { href: "/teacher/records",           label: t("nav.records"),       icon: "📒" },
    { href: "/teacher/pending",           label: t("nav.needsReview"),   icon: "📋" },
    { href: "/teacher/exam-configs",      label: t("nav.examConfigs"),   icon: "⚙️" },
    { href: "/teacher/question-bank",     label: t("nav.questionBank"),  icon: "🗂️" },
    { href: "/teacher/curricula",         label: t("nav.manageMyCurricula"), icon: "📚" },
    { href: "/teacher/help",              label: t("nav.guide"),         icon: "📘" },
  ];

  const adminNav = [
    { href: "/admin",              label: t("nav.adminStats"),        icon: "📊" },
    { href: "/admin/teachers",     label: t("nav.teachers"),          icon: "👨‍🏫" },
    { href: "/admin/users",        label: t("nav.allUsers"),          icon: "👥" },
    { href: "/admin/curricula",    label: t("nav.manageCurricula"),   icon: "📚" },
    { href: "/admin/servers",      label: t("nav.servers"),           icon: "🖥️" },
    { href: "/admin/plans",        label: t("nav.plansAndPricing"),   icon: "💰" },
    { href: "/admin/coupons",      label: t("nav.coupons"),           icon: "🏷️" },
    { href: "/admin/ai-settings",  label: t("nav.aiSettings"),        icon: "🤖" },
    { href: "/teacher/exam-configs", label: t("nav.examsShort"),      icon: "✏️" },
    { href: "/admin/help",         label: t("nav.guide"),             icon: "📘" },
  ];

  const nav = isAdmin()
    ? adminNav
    : user?.role === "teacher"
      ? teacherNav
      : studentNav;

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const sideClass = dir === "rtl"
    ? "border-l right-0"
    : "border-r left-0";

  return (
    <aside className={clsx("w-64 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col h-screen fixed top-0 z-40", sideClass)} dir={dir}>
      {/* Brand */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">{t("appName")}</div>
              <div className="text-xs text-slate-500">{t("appTagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.full_name}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {user?.role === "teacher" && (
            <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">{t("roles.teacher")}</span>
          )}
          {isAdmin() && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t("roles.admin")}</span>
          )}
          {user?.role === "student" && (
            <span className={clsx(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              user.plan === "free" ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"
            )}>
              {user.plan === "free" ? t("plans.free") : user.plan === "monthly" ? t("plans.monthly") : t("plans.yearly")}
            </span>
          )}
        </div>
        {user?.role === "student" && <TeacherSwitcher />}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-blue-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Usage (students only) */}
      {user?.role === "student" && user && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 mb-2">{t("sidebar.dailyUsage")}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {t("sidebar.questions")}: {user.questions_generated_today}/20
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min((user.questions_generated_today / 20) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Change password / Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <Link
          href="/auth/change-password"
          className={clsx("block w-full text-sm text-slate-500 hover:text-blue-600 transition-colors py-1", dir === "rtl" ? "text-right" : "text-left")}
        >
          🔒 {t("sidebar.changePassword")}
        </Link>
        <button
          onClick={handleLogout}
          className={clsx("w-full text-sm text-slate-500 hover:text-red-600 transition-colors py-1", dir === "rtl" ? "text-right" : "text-left")}
        >
          {t("sidebar.logout")} →
        </button>
      </div>
    </aside>
  );
}

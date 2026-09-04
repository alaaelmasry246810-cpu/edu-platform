"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

type Tab = "login" | "student" | "teacher";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { t, dir } = useI18n();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [studentForm, setStudentForm] = useState({ email: "", full_name: "", password: "", teacher_code: "" });
  const [teacherForm, setTeacherForm] = useState({ email: "", full_name: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.login(loginForm);
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
      setAuth(data.user, data.access_token);
      if (data.user.must_change_password) router.push("/auth/change-password");
      else if (data.user.role === "admin") router.push("/admin");
      else if (data.user.role === "teacher") router.push("/teacher");
      else router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("auth.login.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.register(studentForm);
      toast.success(t("auth.studentRegister.success"));
      setTab("login");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("auth.studentRegister.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.registerTeacher(teacherForm);
      toast.success(t("auth.teacherRegister.success", { code: data.teacher_code }));
      setTab("login");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("auth.teacherRegister.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Language switcher */}
        <div className="flex justify-center mb-4">
          <LanguageSwitcher className="!text-slate-200 !border-slate-500 hover:!bg-white/10" />
        </div>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-white">{t("appName")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("auth.tagline")}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden" dir={dir}>
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {([
              { key: "login",   label: t("auth.tabs.login") },
              { key: "student", label: t("auth.tabs.student") },
              { key: "teacher", label: t("auth.tabs.teacher") },
            ] as { key: Tab; label: string }[]).map(tab_ => (
              <button
                key={tab_.key}
                onClick={() => setTab(tab_.key)}
                className={clsx(
                  "flex-1 py-3.5 text-xs font-semibold transition-colors",
                  tab === tab_.key
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                {tab_.label}
              </button>
            ))}
          </div>

          <div className="p-7">
            {/* Login */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelCls}>{t("auth.fields.email")}</label>
                  <input type="email" required value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    className={inputCls} placeholder="example@email.com" />
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.password")}</label>
                  <input type="password" required value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    className={inputCls} placeholder="••••••••" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm mt-2">
                  {loading ? t("auth.login.submitting") : t("auth.login.submit")}
                </button>
              </form>
            )}

            {/* Student register */}
            {tab === "student" && (
              <form onSubmit={handleStudentRegister} className="space-y-4">
                <div>
                  <label className={labelCls}>{t("auth.fields.fullName")}</label>
                  <input type="text" required value={studentForm.full_name}
                    onChange={e => setStudentForm({ ...studentForm, full_name: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.email")}</label>
                  <input type="email" required value={studentForm.email}
                    onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.password")}</label>
                  <input type="password" required minLength={8} value={studentForm.password}
                    onChange={e => setStudentForm({ ...studentForm, password: e.target.value })}
                    className={inputCls} placeholder={t("auth.fields.passwordMinLength")} />
                </div>
                <div>
                  <label className={labelCls}>
                    {t("auth.fields.teacherCode")} <span className="text-slate-400 font-normal text-xs">{t("auth.fields.teacherCodeHint")}</span>
                  </label>
                  <input type="text" value={studentForm.teacher_code}
                    onChange={e => setStudentForm({ ...studentForm, teacher_code: e.target.value.toUpperCase() })}
                    className={inputCls} placeholder={t("auth.fields.teacherCodeExample")} maxLength={12}
                    style={{ letterSpacing: "0.15em" }} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm">
                  {loading ? t("auth.studentRegister.submitting") : t("auth.studentRegister.submit")}
                </button>
              </form>
            )}

            {/* Teacher register */}
            {tab === "teacher" && (
              <form onSubmit={handleTeacherRegister} className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
                  {t("auth.teacherRegister.notice")}
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.fullName")}</label>
                  <input type="text" required value={teacherForm.full_name}
                    onChange={e => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.email")}</label>
                  <input type="email" required value={teacherForm.email}
                    onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("auth.fields.password")}</label>
                  <input type="password" required minLength={8} value={teacherForm.password}
                    onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    className={inputCls} placeholder={t("auth.fields.passwordMinLength")} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm">
                  {loading ? t("auth.teacherRegister.submitting") : t("auth.teacherRegister.submit")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

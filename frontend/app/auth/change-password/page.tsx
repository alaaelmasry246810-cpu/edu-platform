"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { t, dir } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(t("auth.changePassword.mismatch"));
      return;
    }
    setLoading(true);
    try {
      await authAPI.changePassword({ new_password: password });
      updateUser({ must_change_password: false });
      toast.success(t("auth.changePassword.success"));
      // ?next=/a/<token> brings a student back to the activity link they signed in from.
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) router.replace(next);
      else if (user?.role === "admin") router.replace("/admin");
      else if (user?.role === "teacher") router.replace("/teacher");
      else router.replace("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("auth.changePassword.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white";
  const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-white">{t("auth.changePassword.title")}</h1>
          <p className="text-slate-400 text-sm mt-2">{t("auth.changePassword.subtitle")}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-7" dir={dir}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>{t("auth.changePassword.newPassword")}</label>
              <input
                type="password" required minLength={8} value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputCls} placeholder={t("auth.fields.passwordMinLength")}
              />
            </div>
            <div>
              <label className={labelCls}>{t("auth.changePassword.confirmPassword")}</label>
              <input
                type="password" required minLength={8} value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 text-sm mt-2">
              {loading ? t("auth.changePassword.submitting") : t("auth.changePassword.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import toast from "react-hot-toast";
import { activitiesAPI, authAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import ActivityPlayer from "@/components/activities/ActivityPlayer";
import { LeaderboardPanel } from "@/components/activities/Leaderboard";

interface Guest { name: string; phone: string; className: string; key: string }
const guestStore = (token: string) => `activity_guest_${token}`;
const inputCls = "w-full border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-xl px-4 py-3 outline-none focus:border-blue-500";

/**
 * Public share link for an activity. It opens on a sign-up screen so every
 * result lands in the teacher's records:
 *  - the teacher's registered students sign in → result goes to their record;
 *  - anyone else (if the teacher allows) enters name, phone and class.
 *    A phone that belongs to a registered student must sign in instead.
 */
export default function SharedActivity() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { t, dir, toggleLocale, locale } = useI18n();
  const { setAuth } = useAuthStore();
  const [activity, setActivity] = useState<any>(null);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [mode, setMode] = useState<"new" | "login">("new");
  const [form, setForm] = useState({ name: "", phone: "", className: "" });
  const [login, setLogin] = useState({ phone: "", password: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => activitiesAPI.shared(token).then(({ data }) => setActivity(data)).catch((err) => setError(err.response?.data?.detail || t("games.loadError")));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(guestStore(token)) || "null");
      if (saved?.name && saved?.phone) setGuest(saved);
    } catch {}
    load();
  }, [token]);

  const signedIn = !!activity?.signed_in_as;

  const startAsGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNotice("");
    try {
      const { data } = await activitiesAPI.checkGuest(token, form.phone);
      if (data.registered) {
        // A registered student: their result must go to their own record.
        setLogin({ phone: form.phone, password: "" });
        setMode("login");
        setNotice(t("games.share.registeredNotice"));
        return;
      }
      const g: Guest = {
        name: form.name.trim().slice(0, 40), phone: form.phone.trim(), className: form.className.trim().slice(0, 100),
        key: guest?.key ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`,
      };
      try { localStorage.setItem(guestStore(token), JSON.stringify(g)); } catch {}
      setGuest(g);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("games.editor.error"));
    } finally { setBusy(false); }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await authAPI.login(login);
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
      setAuth(data.user, data.access_token);
      if (data.user.must_change_password) { router.push(`/auth/change-password?next=/a/${token}`); return; }
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t("auth.login.error"));
    } finally { setBusy(false); }
  };

  const shell = (children: React.ReactNode) => (
    <div dir={dir} className="min-h-screen bg-gradient-to-b from-blue-50 to-violet-50 dark:from-slate-950 dark:to-slate-900">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur">
        <Link href="/" className="font-bold text-slate-800 dark:text-slate-100">🎓 {t("appName")}</Link>
        <button onClick={toggleLocale} className="text-xs border rounded-full px-3 py-1 border-slate-300 dark:border-slate-600">{locale === "ar" ? "EN" : "ع"}</button>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">{children}</main>
    </div>
  );

  if (error) return shell(
    <div className="text-center py-20 space-y-3">
      <p className="text-5xl">🔒</p>
      <p className="text-slate-600 dark:text-slate-300">{error}</p>
      <Link href="/auth/login" className="inline-block px-5 py-2 rounded-xl bg-blue-600 text-white font-bold">{t("games.share.login")}</Link>
    </div>,
  );
  if (!activity) return shell(<div className="h-64 rounded-2xl bg-white/60 dark:bg-slate-800 animate-pulse" />);

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{activity.title}</h1>
      <p className="text-sm text-slate-500">
        {activity.owner_name && `👤 ${activity.owner_name} · `}{t("games.list.items", { n: activity.item_count })}
        {signedIn ? ` · ${t("games.share.playingAs", { name: activity.signed_in_as })}` : guest ? ` · ${t("games.share.playingAs", { name: guest.name })}` : ""}
        {!signedIn && guest && (
          <button onClick={() => { setForm({ name: guest.name, phone: guest.phone, className: guest.className }); setGuest(null); }} className="ms-2 text-blue-600 hover:underline">
            {t("games.share.changeName")}
          </button>
        )}
      </p>
      {activity.description && <p className="text-slate-500 mt-1">{activity.description}</p>}
    </div>
  );

  // Sign-up screen: registered student signs in, anyone else fills in their details.
  if (!signedIn && !guest) {
    const guestsAllowed = activity.allow_guests !== false;
    const tab = guestsAllowed ? mode : "login";
    return shell(
      <>
        {header}
        <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <p className="text-center text-sm text-slate-500">{t("games.share.signupIntro", { teacher: activity.owner_name ?? "" })}</p>
          {guestsAllowed && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
              {(["new", "login"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setNotice(""); }}
                  className={clsx("py-2 rounded-lg text-sm font-bold", tab === m ? "bg-white dark:bg-slate-700 shadow text-blue-600" : "text-slate-500")}>
                  {m === "new" ? `✍️ ${t("games.share.newStudent")}` : `👤 ${t("games.share.registered")}`}
                </button>
              ))}
            </div>
          )}
          {notice && <p className="text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl p-3">{notice}</p>}

          {tab === "new" ? (
            <form onSubmit={startAsGuest} className="space-y-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} placeholder={t("games.share.fullName")} className={inputCls} />
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" dir="ltr" placeholder={t("games.share.phone")} className={inputCls + " text-start"} />
              <input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} maxLength={100} placeholder={t("games.share.className")} className={inputCls} />
              <p className="text-[11px] text-slate-400">{t("games.share.privacy")}</p>
              <button disabled={busy || !form.name.trim() || form.phone.replace(/\D/g, "").length < 8} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-40">
                {busy ? "…" : `▶ ${t("games.share.start")}`}
              </button>
            </form>
          ) : (
            <form onSubmit={signIn} className="space-y-3">
              {!guestsAllowed && <p className="text-sm text-slate-500">{t("games.share.studentsOnly")}</p>}
              <input required value={login.phone} onChange={(e) => setLogin({ ...login, phone: e.target.value })} inputMode="tel" dir="ltr" placeholder={t("games.share.phone")} className={inputCls + " text-start"} />
              <input required type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} placeholder={t("games.share.password")} className={inputCls} />
              <button disabled={busy} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-40">{busy ? "…" : t("games.share.signIn")}</button>
              <p className="text-[11px] text-slate-400">{t("games.share.forgot")}</p>
            </form>
          )}
        </div>
      </>,
    );
  }

  return shell(
    <>
      {header}
      <ActivityPlayer
        activity={activity}
        onSave={(template, r) => activitiesAPI.sharedAttempt(token, {
          template, ...r,
          ...(signedIn ? {} : { guest_name: guest!.name, guest_key: guest!.key, guest_phone: guest!.phone, guest_class: guest!.className }),
        })}
        resultExtra={(savedAt) => activity.leaderboard_visible && (
          <LeaderboardPanel refreshKey={savedAt} load={() => activitiesAPI.sharedLeaderboard(token, signedIn ? undefined : guest!.key)} />
        )}
      />
    </>,
  );
}

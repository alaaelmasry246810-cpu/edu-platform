"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { activitiesAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import ActivityPlayer from "@/components/activities/ActivityPlayer";
import { LeaderboardPanel } from "@/components/activities/Leaderboard";

const guestStore = (token: string) => `activity_guest_${token}`;

/** Public share link for an activity: signed-in users play as themselves,
 *  others (if the teacher allows guests) play under a name. */
export default function SharedActivity() {
  const { token } = useParams<{ token: string }>();
  const { t, dir, toggleLocale, locale } = useI18n();
  const [activity, setActivity] = useState<any>(null);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState<{ name: string; key: string } | null>(null);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(guestStore(token)) || "null");
      if (saved?.name) setGuest(saved);
    } catch {}
    activitiesAPI.shared(token).then(({ data }) => setActivity(data)).catch((err) => setError(err.response?.data?.detail || t("games.loadError")));
  }, [token]);

  const signedIn = !!activity?.signed_in_as;
  const startAsGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim().slice(0, 40);
    if (!name) return;
    // Random key so two guests with the same name stay separate on the leaderboard.
    const g = { name, key: guest?.key ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}` };
    try { localStorage.setItem(guestStore(token), JSON.stringify(g)); } catch {}
    setGuest(g);
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
        {!signedIn && guest && <button onClick={() => { setNameInput(guest.name); setGuest(null); }} className="ms-2 text-blue-600 hover:underline">{t("games.share.changeName")}</button>}
      </p>
      {activity.description && <p className="text-slate-500 mt-1">{activity.description}</p>}
    </div>
  );

  // Guests type a name first (it's what appears on the leaderboard).
  if (!signedIn && !guest) return shell(
    <>
      {header}
      <form onSubmit={startAsGuest} className="max-w-sm mx-auto bg-white dark:bg-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-center">
        <p className="text-4xl">👋</p>
        <p className="font-bold text-slate-800 dark:text-slate-100">{t("games.share.enterName")}</p>
        <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={40} placeholder={t("games.live.nickname")}
          className="w-full text-center text-lg font-bold border-2 border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-xl py-3 outline-none focus:border-blue-500" />
        <button disabled={!nameInput.trim()} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-40">▶ {t("games.share.start")}</button>
        <p className="text-xs text-slate-400">{t("games.share.orLogin")} <Link href="/auth/login" className="text-blue-600 hover:underline">{t("games.share.login")}</Link></p>
      </form>
    </>,
  );

  return shell(
    <>
      {header}
      <ActivityPlayer
        activity={activity}
        onSave={(template, r) => activitiesAPI.sharedAttempt(token, { template, ...r, ...(signedIn ? {} : { guest_name: guest!.name, guest_key: guest!.key }) })}
        resultExtra={(savedAt) => activity.leaderboard_visible && (
          <LeaderboardPanel refreshKey={savedAt} load={() => activitiesAPI.sharedLeaderboard(token, signedIn ? undefined : guest!.key)} />
        )}
      />
    </>,
  );
}

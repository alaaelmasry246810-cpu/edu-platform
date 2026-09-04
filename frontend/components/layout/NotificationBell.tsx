"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notifAPI } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const { t, dir, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count every 30s
  useEffect(() => {
    const fetchCount = () =>
      notifAPI.unreadCount().then(({ data }) => setCount(data.count)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = async () => {
    if (!open) {
      setLoading(true);
      try {
        const { data } = await notifAPI.list();
        setNotifs(data);
      } finally {
        setLoading(false);
      }
    }
    setOpen(prev => !prev);
  };

  const handleMarkAll = async () => {
    await notifAPI.markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setCount(0);
  };

  const handleClick = async (n: Notif) => {
    if (!n.is_read) {
      await notifAPI.markRead(n.id);
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setCount(prev => Math.max(0, prev - 1));
    }
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  };

  const typeIcon: Record<string, string> = {
    exam_submitted: "📋",
    exam_approved:  "✅",
    exam_rejected:  "❌",
    exam_needs_revision: "✏️",
    info: "ℹ️",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={t("notifications.tooltip")}
      >
        <span className="text-lg">🔔</span>
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden" dir={dir}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-slate-800 dark:text-white text-sm">{t("notifications.title")}</span>
            {count > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:underline">
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">{t("notifications.none")}</div>
            )}
            {!loading && notifs.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 last:border-0 ${
                  !n.is_read ? "bg-blue-50/60 dark:bg-blue-900/10" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-base mt-0.5 shrink-0">{typeIcon[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{n.body}</p>
                    )}
                    <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">
                      {new Date(n.created_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

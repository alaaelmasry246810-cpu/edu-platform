"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/api";
import toast from "react-hot-toast";

/**
 * Client-side console/DevTools hardening.
 *
 * Only one part of this is a REAL security measure: the console warning
 * below, which protects users from "self-XSS" social-engineering scams
 * (someone convincing a user to paste attacker-supplied JS into their own
 * console to "unlock a feature" — this actually happens and actually works
 * on unwarned users).
 *
 * Everything else here (blocking F12 / Ctrl+Shift+I / right-click / view
 * source, and the DevTools-open heuristic below) is NOT a real security
 * boundary — any of it is trivially bypassed (a different browser, disabling
 * JS, DevTools' own menu instead of the F12 shortcut, calling the API
 * directly with curl, etc.), and none of it can affect the server, the
 * database, or any other user. The real access control is — and must
 * remain — enforced server-side on every endpoint.
 *
 * The auto-suspend below was explicitly requested despite that: there is no
 * reliable way to detect "DevTools is open", so this heuristic (comparing
 * outer/inner window size, sustained over several checks to cut down on
 * transient false positives from resizing, rotation, etc.) WILL occasionally
 * suspend legitimate accounts for reasons that have nothing to do with
 * DevTools. That's a known, accepted trade-off of this feature, not a bug —
 * an admin (or, for a student, their teacher) can reactivate the account
 * from Users/Teachers in one click, and the "suspension_reason" shown there
 * tells them it was this automatic check rather than a manual action.
 */
const CHECK_INTERVAL_MS = 2000;
const SUSTAINED_CHECKS_REQUIRED = 3; // ~6s of sustained detection before acting
const SIZE_THRESHOLD_PX = 160;

export default function SecurityHardening() {
  const { locale } = useI18n();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const suspendedRef = useRef(false);

  useEffect(() => {
    const banner = locale === "ar"
      ? {
          title: "قف!",
          body: "لو حد طلب منك تلصق كود هنا عشان \"تفتح ميزة\" أو \"تربح حاجة\"، ده احتيال وبيقدر يسرق حسابك. متلصقش أي كود هنا من غير ما تفهم بالظبط بيعمل إيه.",
        }
      : {
          title: "Stop!",
          body: "If someone told you to paste code here to \"unlock a feature\" or \"get something free\", it's a scam that can hijack your account. Don't paste anything here you don't fully understand.",
        };

    // eslint-disable-next-line no-console
    console.log(`%c${banner.title}`, "color:#dc2626;font-size:48px;font-weight:900;");
    // eslint-disable-next-line no-console
    console.log(`%c${banner.body}`, "font-size:15px;line-height:1.6;");

    const blockContextMenu = (e: MouseEvent) => e.preventDefault();

    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isDevToolsShortcut =
        key === "f12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(key)) ||
        (e.metaKey && e.altKey && ["i", "j", "c"].includes(key)) || // macOS
        (e.ctrlKey && key === "u"); // view-source
      if (isDevToolsShortcut) e.preventDefault();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys);
    };
  }, [locale]);

  // DevTools-open heuristic → auto-suspend (see the big caveat above).
  useEffect(() => {
    if (!user) return; // nothing to suspend if not logged in

    let sustainedCount = 0;

    const suspend = async () => {
      if (suspendedRef.current) return;
      suspendedRef.current = true;
      try {
        await authAPI.reportDevtools();
      } catch {
        // even if the request fails, log the user out locally
      }
      toast.error(
        locale === "ar"
          ? "تم إيقاف حسابك مؤقتًا. تواصل مع الآدمن أو معلمك لإعادة التفعيل."
          : "Your account has been suspended. Contact your admin or teacher to reactivate it.",
        { duration: 8000 }
      );
      logout();
      router.replace("/auth/login");
    };

    const interval = setInterval(() => {
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;
      const likelyOpen = widthDelta > SIZE_THRESHOLD_PX || heightDelta > SIZE_THRESHOLD_PX;

      if (likelyOpen) {
        sustainedCount += 1;
        if (sustainedCount >= SUSTAINED_CHECKS_REQUIRED) {
          suspend();
        }
      } else {
        sustainedCount = 0;
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, locale, logout, router]);

  return null;
}

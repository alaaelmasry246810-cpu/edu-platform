"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // sw.js caches /_next/static/* cache-first, which is only safe in
    // production where Next.js content-hashes those filenames (a new build
    // gets new URLs, so nothing is ever actually "stale"). In dev mode the
    // same URLs (e.g. /_next/static/chunks/app/layout.js) keep their content
    // updated in place — a service worker installed once during dev
    // permanently pins whatever JS was cached the first time, so code fixes
    // silently stop applying no matter how many times the page is
    // hard-refreshed. Registering it only in production avoids that trap;
    // also actively unregister a dev SW a previous run may have installed.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service worker registered:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] Service worker registration failed:", err);
      });
  }, []);

  return null;
}

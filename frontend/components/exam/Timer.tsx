"use client";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

export default function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const pct = remaining / seconds;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const danger = pct < 0.2;

  return (
    <div className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold",
      danger ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
             : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
    )}>
      ⏱️ {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

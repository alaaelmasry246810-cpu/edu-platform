"use client";
import { useI18n } from "@/lib/i18n";

export interface GuideItem {
  label: string;
  desc: string;
}

export interface GuideSection {
  icon: string;
  title: string;
  desc: string;
  items: GuideItem[];
}

export default function GuideView({ title, subtitle, sections }: { title: string; subtitle: string; sections: GuideSection[] }) {
  const { dir } = useI18n();

  return (
    <div dir={dir}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
      </div>

      <div className="space-y-5">
        {sections.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{s.icon}</span>
              <div>
                <h2 className="font-bold text-slate-800 dark:text-white">{s.title}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
            {s.items.length > 0 && (
              <ul className="space-y-2.5 ms-2">
                {s.items.map((it, j) => (
                  <li key={j} className="flex gap-2 text-sm">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{it.label}</span>
                      <span className="text-slate-500 dark:text-slate-400"> — {it.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

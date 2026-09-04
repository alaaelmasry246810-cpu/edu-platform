"use client";
import { useI18n } from "@/lib/i18n";
import clsx from "clsx";

export interface ScheduleEntry {
  day: string;
  start_time: string;
  end_time: string;
  title: string;
  source?: "teacher" | "student";
}

interface Props {
  entries: ScheduleEntry[];
  titlePlaceholder: string;
  addRowLabel: string;
  /** Entries this viewer cannot edit/delete (shown locked, e.g. teacher-owned slots for a student viewer) */
  isLocked?: (e: ScheduleEntry) => boolean;
  lockedLabel?: string;
  ownLabel?: string;
  onAdd: (day: string) => void;
  onEdit: (index: number, field: "start_time" | "end_time" | "title", value: string) => void;
  onRemove: (index: number) => void;
}

const DAY_ORDER = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function ScheduleGrid({
  entries, titlePlaceholder, addRowLabel, isLocked, lockedLabel, ownLabel, onAdd, onEdit, onRemove,
}: Props) {
  const { t, dir } = useI18n();

  return (
    <div className="space-y-5" dir={dir}>
      {DAY_ORDER.map((day) => {
        const dayEntries = entries
          .map((e, idx) => ({ e, idx }))
          .filter(({ e }) => e.day === day)
          .sort((a, b) => a.e.start_time.localeCompare(b.e.start_time));

        return (
          <div key={day} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{t(`dashboard.schedule.days.${day}`)}</h3>
              <button onClick={() => onAdd(day)} className="text-xs text-blue-600 hover:underline">{addRowLabel}</button>
            </div>

            {dayEntries.length === 0 ? (
              <p className="text-xs text-slate-400">—</p>
            ) : (
              <div className="space-y-2">
                {dayEntries.map(({ e, idx }) => {
                  const locked = isLocked?.(e) ?? false;
                  return (
                    <div
                      key={idx}
                      className={clsx(
                        "flex items-center gap-2 rounded-xl p-2",
                        locked ? "bg-amber-50 dark:bg-amber-900/10" : "bg-slate-50 dark:bg-slate-900"
                      )}
                    >
                      <input
                        type="time"
                        value={e.start_time}
                        disabled={locked}
                        onChange={ev => onEdit(idx, "start_time", ev.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 disabled:opacity-60"
                      />
                      <span className="text-slate-400 text-xs">→</span>
                      <input
                        type="time"
                        value={e.end_time}
                        disabled={locked}
                        onChange={ev => onEdit(idx, "end_time", ev.target.value)}
                        className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 disabled:opacity-60"
                      />
                      <input
                        type="text"
                        value={e.title}
                        disabled={locked}
                        placeholder={titlePlaceholder}
                        onChange={ev => onEdit(idx, "title", ev.target.value)}
                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 disabled:opacity-60"
                      />
                      {e.source && (
                        <span className={clsx(
                          "text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap",
                          e.source === "teacher" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {e.source === "teacher" ? lockedLabel : ownLabel}
                        </span>
                      )}
                      <button
                        onClick={() => onRemove(idx)}
                        disabled={locked}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed px-1 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

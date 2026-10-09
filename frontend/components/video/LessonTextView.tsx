"use client";
import { useEffect, useRef } from "react";
import clsx from "clsx";

export interface TextSentence {
  text: string;
  group?: number;        // scene index (AI videos) — sentences are grouped under its title
}

interface Props {
  sentences: TextSentence[];
  active: number;
  groupTitles?: string[];
  variant: "full" | "strip";
  onPick?: (index: number) => void;
}

/**
 * The lesson's own text with the sentence being spoken lit up, so the
 * student's eyes stay on the part being explained. "full" is a scrolling
 * reading view; "strip" is a karaoke-style line (previous / current / next).
 */
export default function LessonTextView({ sentences, active, groupTitles, variant, onPick }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const scrolledOnce = useRef(false);

  // Keep the lit sentence a third of the way down the box (scroll the box, not
  // the page): jump there on first show, glide after that.
  useEffect(() => {
    const box = boxRef.current, el = activeRef.current;
    if (!box || !el || variant !== "full") return;
    const top = Math.max(0, el.offsetTop - box.clientHeight / 3);
    if (scrolledOnce.current) box.scrollTo({ top, behavior: "smooth" });
    else box.scrollTop = top;
    scrolledOnce.current = true;
  }, [active, variant, sentences]);

  if (variant === "strip") {
    const prev = sentences[active - 1]?.text;
    const cur = sentences[active]?.text;
    const next = sentences[active + 1]?.text;
    return (
      <div className="text-center leading-relaxed space-y-0.5">
        {prev && <p className="text-[clamp(.6rem,1.3vw,.85rem)] opacity-50 line-clamp-1">{prev}</p>}
        {cur && (
          <p key={active} className="inline-block bg-amber-300 text-slate-900 font-bold rounded-lg px-3 py-1 text-[clamp(.8rem,2vw,1.25rem)] animate-scene-in">
            {cur}
          </p>
        )}
        {next && <p className="text-[clamp(.6rem,1.3vw,.85rem)] opacity-50 line-clamp-1">{next}</p>}
      </div>
    );
  }

  // Group consecutive sentences (by scene for AI videos) into paragraphs.
  const paragraphs: { group?: number; items: { s: TextSentence; i: number }[] }[] = [];
  sentences.forEach((s, i) => {
    const last = paragraphs[paragraphs.length - 1];
    if (last && last.group === s.group) last.items.push({ s, i });
    else paragraphs.push({ group: s.group, items: [{ s, i }] });
  });

  return (
    <div ref={boxRef} className="relative h-full overflow-y-auto px-[5%] py-[4%]">
      {paragraphs.map((para, k) => (
        <div key={k} className="mb-5">
          {para.group !== undefined && groupTitles?.[para.group] && (
            <h3 className="text-[clamp(.8rem,1.8vw,1.15rem)] font-bold text-amber-300 mb-1.5">{groupTitles[para.group]}</h3>
          )}
          <p className="text-[clamp(.95rem,2.4vw,1.6rem)] leading-[1.9]">
            {para.items.map(({ s, i }) => (
              <span
                key={i}
                ref={i === active ? activeRef : undefined}
                onClick={() => onPick?.(i)}
                className={clsx(
                  "rounded-md px-0.5 transition-colors duration-300 cursor-pointer box-decoration-clone",
                  i === active ? "bg-amber-300 text-slate-900 font-semibold shadow-[0_0_0_3px_rgba(252,211,77,.35)]"
                    : i < active ? "text-white" : "text-white/55 hover:text-white/80",
                )}
              >
                {s.text}{" "}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Split narration into sentences (Arabic + Latin punctuation), long ones at commas. */
export function splitSentences(text: string, maxLen = 200): string[] {
  const out: string[] = [];
  for (let part of (text || "").split(/(?<=[.!?؟؛])\s+|\n+/)) {
    part = part.replace(/\s+/g, " ").trim();
    while (part.length > maxLen) {
      let cut = Math.max(part.lastIndexOf("،", maxLen), part.lastIndexOf(",", maxLen));
      if (cut < maxLen / 3) cut = part.lastIndexOf(" ", maxLen);
      if (cut <= 0) break;
      out.push(part.slice(0, cut + 1).trim());
      part = part.slice(cut + 1).trim();
    }
    if (part) out.push(part);
  }
  return out;
}

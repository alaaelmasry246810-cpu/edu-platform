"use client";
import { useId, useState } from "react";
import clsx from "clsx";
import { Graph, Chart, Timeline, MapVisual, Comparison, Sentence, Definition } from "./visualsExtra";

/**
 * Subject-aware visuals for an interactive-video scene. `p` is how far the
 * narration is through the scene (0 → 1); every visual reveals itself in step
 * with it, so the screen shows what the teacher is talking about right now.
 */

export type VisualType =
  | "bullets" | "equation" | "formula" | "diagram" | "process" | "image"
  | "graph" | "chart" | "timeline" | "map" | "comparison" | "sentence" | "definition";

interface Species { formula: string; name?: string }

const SPECIES_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171"];

/** "2H2SO4" → coefficient 2, H₂SO₄ ; "SO4^2-" → SO₄²⁻ ; "Na+" → Na⁺ ; "(aq)" state kept small. */
export function Formula({ f, className }: { f: string; className?: string }) {
  let rest = f.trim();
  const coef = rest.match(/^(\d+(?:\/\d+)?)\s*(?=[A-Z(\[])/)?.[1] ?? "";
  rest = rest.slice(coef.length).trim();
  const state = rest.match(/\((aq|s|l|g)\)$/)?.[0] ?? "";
  if (state) rest = rest.slice(0, -state.length);
  let charge = "";
  const m = rest.match(/\^?(\d*[+-])$/);
  if (m && /[A-Za-z0-9)\]]/.test(rest.slice(0, -m[0].length).slice(-1))) {
    charge = m[1];
    rest = rest.slice(0, -m[0].length);
  }
  const parts = rest.split(/(\d+)/).filter(Boolean);
  return (
    <span className={clsx("font-mono whitespace-nowrap", className)} dir="ltr">
      {coef && <span className="me-0.5 text-amber-300">{coef}</span>}
      {parts.map((p, i) => (/^\d+$/.test(p) && i > 0 ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>))}
      {charge && <sup>{charge}</sup>}
      {state && <span className="text-[0.6em] opacity-70 ms-0.5">{state}</span>}
    </span>
  );
}

function Equation({ d, p }: { d: any; p: number }) {
  const reactants: Species[] = d.reactants ?? [];
  const products: Species[] = d.products ?? [];
  const stage = p < 0.3 ? 0 : p < 0.55 ? 1 : 2; // reactants → reacting → products
  const card = (s: Species, i: number, side: "r" | "p") => (
    <div
      key={side + i}
      className={clsx(
        "rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center transition-all duration-700",
        side === "r" && stage === 1 && "animate-[vidShake_.35s_ease-in-out_infinite]",
        side === "r" && stage === 2 && "opacity-50 scale-90",
        side === "p" && (stage === 2 ? "opacity-100 scale-100" : "opacity-0 scale-50"),
      )}
      style={{ transitionDelay: `${i * 150}ms`, boxShadow: side === "p" && stage === 2 ? `0 0 24px ${SPECIES_COLORS[(i + 3) % 6]}66` : undefined }}
    >
      <Formula f={s.formula} className="text-[clamp(1rem,3vw,2rem)] font-bold" />
      {s.name && <div className="text-[clamp(.6rem,1.4vw,.85rem)] opacity-80 mt-0.5">{s.name}</div>}
    </div>
  );
  const plus = (k: string) => <span key={k} className="text-[clamp(1rem,2.5vw,1.8rem)] opacity-70">+</span>;
  const join = (xs: Species[], side: "r" | "p") => xs.flatMap((s, i) => (i ? [plus(side + "+" + i), card(s, i, side)] : [card(s, i, side)]));

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {d.reaction_type && <span className="text-xs bg-white/15 rounded-full px-3 py-1">⚗️ {d.reaction_type}</span>}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" dir="ltr">
        {join(reactants, "r")}
        <div className="flex flex-col items-center mx-1 sm:mx-3 min-w-[3.5rem]">
          <span className={clsx("text-[clamp(.55rem,1.3vw,.8rem)] mb-1 transition-opacity", stage >= 1 ? "opacity-90" : "opacity-0")} dir="auto">
            {d.condition}
          </span>
          <div className="relative h-1 w-14 sm:w-24 bg-white/20 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-amber-300 transition-all duration-700" style={{ width: stage === 0 ? "0%" : "100%" }} />
          </div>
          <span className="text-amber-300 -mt-2.5 self-end text-lg leading-none">➤</span>
        </div>
        {join(products, "p")}
      </div>

      {/* The reaction itself: reactant particles collide and recombine into product particles */}
      <div className="relative w-full max-w-md h-16 sm:h-20 rounded-xl bg-black/20 overflow-hidden" dir="ltr">
        {reactants.map((_, i) => (
          <span
            key={"rp" + i}
            className="absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-1000 ease-in"
            style={{
              background: SPECIES_COLORS[i % 6],
              top: `${30 + (i % 2) * 25}%`,
              left: stage === 0 ? `${8 + i * 12}%` : "47%",
              opacity: stage === 2 ? 0 : 1,
              transform: stage === 1 ? "scale(1.25)" : "scale(1)",
            }}
          />
        ))}
        {stage >= 1 && <span className={clsx("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl", stage === 1 ? "animate-ping" : "opacity-0")}>✨</span>}
        {products.map((_, i) => (
          <span
            key={"pp" + i}
            className="absolute w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all duration-1000 ease-out ring-2 ring-white/50"
            style={{
              background: `linear-gradient(135deg, ${SPECIES_COLORS[(i + 3) % 6]}, ${SPECIES_COLORS[(i + 4) % 6]})`,
              top: `${30 + (i % 2) * 25}%`,
              left: stage === 2 ? `${70 + i * 10}%` : "47%",
              opacity: stage === 2 ? 1 : 0,
            }}
          />
        ))}
      </div>
      {d.observation && (
        <p className={clsx("text-[clamp(.7rem,1.6vw,.95rem)] text-center max-w-xl transition-opacity duration-700", p > 0.75 ? "opacity-100" : "opacity-0")}>
          👁️ {d.observation}
        </p>
      )}
    </div>
  );
}

function FormulaLaw({ d, p }: { d: any; p: number }) {
  const vars: any[] = d.variables ?? [];
  const shown = Math.ceil(Math.max(0, p - 0.15) / 0.85 * vars.length);
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-[clamp(1.4rem,5vw,3.2rem)] font-bold font-mono bg-white/10 rounded-2xl px-6 py-3 border border-white/20" dir="ltr">
        {d.expression}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full max-w-2xl">
        {vars.map((v, i) => (
          <div key={i} className={clsx("rounded-xl bg-black/20 px-3 py-2 transition-all duration-500", i < shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}>
            <span className="font-mono font-bold text-amber-300 text-lg" dir="ltr">{v.symbol}</span>
            <span className="text-sm ms-2">{v.meaning}</span>
            {v.unit && <div className="text-xs opacity-70">{v.unit}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Diagram({ d, p }: { d: any; p: number }) {
  const uid = useId().replace(/:/g, "");
  const parts: any[] = d.parts ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const auto = parts.length ? Math.min(parts.length - 1, Math.floor(p * parts.length)) : -1;
  const activeId = picked ?? parts[auto]?.id;
  const active = parts.find((x) => x.id === activeId);
  const esc = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/"/g, ""));
  const doneIds = parts.slice(0, Math.max(0, auto)).map((x) => x.id);

  return (
    <div className="w-full h-full flex flex-col items-center gap-2">
      <style dangerouslySetInnerHTML={{ __html: `
        #d${uid} svg { width: 100%; height: 100%; }
        #d${uid} [data-part] { opacity: .35; transition: opacity .5s, filter .5s; cursor: pointer; }
        ${doneIds.map((id) => `#d${uid} [data-part="${esc(id)}"]`).join(",") || "#none"} { opacity: .8; }
        ${activeId ? `#d${uid} [data-part="${esc(activeId)}"] { opacity: 1; filter: drop-shadow(0 0 6px #facc15) drop-shadow(0 0 14px #facc15aa); }` : ""}
      ` }} />
      <div
        id={`d${uid}`}
        className="flex-1 w-full min-h-0 bg-white/95 rounded-xl p-2"
        onClick={(e) => {
          const el = (e.target as Element).closest("[data-part]");
          setPicked(el ? el.getAttribute("data-part") : null);
        }}
        dangerouslySetInnerHTML={{ __html: d.svg }}
      />
      {active && (
        <div className="w-full rounded-lg bg-black/30 px-3 py-1.5 text-center animate-scene-in" key={active.id}>
          <span className="font-bold text-amber-300">{active.label}</span>
          {active.description && <span className="text-[clamp(.65rem,1.5vw,.9rem)] opacity-90"> — {active.description}</span>}
        </div>
      )}
      {parts.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1">
          {parts.map((x) => (
            <button
              key={x.id}
              onClick={() => setPicked(x.id === picked ? null : x.id)}
              className={clsx("text-[10px] sm:text-xs px-2 py-0.5 rounded-full border", x.id === activeId ? "bg-amber-300 text-slate-900 border-amber-300" : "border-white/30 opacity-80")}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Process({ d, p }: { d: any; p: number }) {
  const steps: any[] = d.steps ?? [];
  const active = Math.min(steps.length - 1, Math.floor(p * steps.length));
  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={clsx(
                "rounded-xl px-3 py-2 text-center min-w-[5.5rem] max-w-[9rem] border transition-all duration-500",
                i === active ? "bg-amber-300 text-slate-900 border-amber-300 scale-105 shadow-lg" : i < active ? "bg-white/20 border-white/30" : "bg-white/5 border-white/15 opacity-50",
              )}
            >
              <div className="text-xl">{s.icon || "🔹"}</div>
              <div className="text-[clamp(.7rem,1.6vw,.95rem)] font-bold">{s.label}</div>
              {s.detail && i <= active && <div className="text-[10px] sm:text-xs opacity-80 mt-0.5">{s.detail}</div>}
            </div>
            {i < steps.length - 1 && <span className={clsx("text-lg transition-opacity rtl:rotate-180", i < active ? "opacity-100" : "opacity-30")}>➜</span>}
          </div>
        ))}
      </div>
      {d.cycle && <span className={clsx("text-sm transition-opacity", p > 0.85 ? "opacity-100" : "opacity-30")}>🔄</span>}
    </div>
  );
}

function ImageVisual({ d, p }: { d: any; p: number }) {
  if (!d.url) return null;
  return (
    <figure className="w-full h-full flex flex-col items-center gap-1 min-h-0">
      <div className="flex-1 min-h-0 w-full rounded-xl overflow-hidden bg-white flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.url}
          alt={d.caption || ""}
          className="max-w-full max-h-full object-contain transition-transform duration-1000 ease-linear"
          style={{ transform: `scale(${1 + Math.min(1, p) * 0.08})` }}
        />
      </div>
      {d.caption && <figcaption className="text-[clamp(.65rem,1.5vw,.9rem)] text-center">{d.caption}</figcaption>}
      {d.credit && <span className="text-[9px] opacity-60" dir="ltr">{d.credit}</span>}
    </figure>
  );
}

export default function SceneVisual({ type, data, p }: { type?: VisualType; data?: any; p: number }) {
  const progress = Math.max(0, Math.min(1, p || 0));
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes vidShake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-3px) rotate(-2deg) } 75% { transform: translateX(3px) rotate(2deg) } }` }} />
      {type === "equation" && <Equation d={data} p={progress} />}
      {type === "formula" && <FormulaLaw d={data} p={progress} />}
      {type === "diagram" && <Diagram d={data} p={progress} />}
      {type === "process" && <Process d={data} p={progress} />}
      {type === "image" && <ImageVisual d={data} p={progress} />}
      {type === "graph" && <Graph d={data} p={progress} />}
      {type === "chart" && <Chart d={data} p={progress} />}
      {type === "timeline" && <Timeline d={data} p={progress} />}
      {type === "map" && <MapVisual d={data} p={progress} />}
      {type === "comparison" && <Comparison d={data} p={progress} />}
      {type === "sentence" && <Sentence d={data} p={progress} />}
      {type === "definition" && <Definition d={data} p={progress} />}
    </>
  );
}

export const hasVisual = (type?: string, data?: any) =>
  !!type && type !== "bullets" && !!data && (type !== "image" || !!data.url);

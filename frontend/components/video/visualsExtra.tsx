"use client";
import clsx from "clsx";

/** More scene visuals so every subject has one: math graphs, charts, history
 *  timelines, maps, comparisons, grammar (إعراب) and key-term cards.
 *  `p` (0 → 1) is the narration's progress through the scene. */

// ── Safe expression evaluator for graphs (no eval) ───────────

type Fn = (x: number) => number;

export function compileExpr(src: string): Fn | null {
  const tokens = src.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")
    .match(/\d+\.?\d*|\.\d+|[a-z]+|[-+*/^(),]/gi);
  if (!tokens) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const FUNCS: Record<string, (v: number) => number> = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs,
    log: Math.log10, ln: Math.log, exp: Math.exp,
  };
  const startsFactor = (t?: string) => !!t && (/^[\d.]/.test(t) || /^[a-z]/i.test(t) || t === "(");

  function expr(): Fn {
    let left = term();
    while (peek() === "+" || peek() === "-") {
      const op = next(); const l = left, r = term();
      left = op === "+" ? (x) => l(x) + r(x) : (x) => l(x) - r(x);
    }
    return left;
  }
  function term(): Fn {
    let left = power();
    for (;;) {
      if (peek() === "*" || peek() === "/") {
        const op = next(); const l = left, r = power();
        left = op === "*" ? (x) => l(x) * r(x) : (x) => l(x) / r(x);
      } else if (startsFactor(peek())) { // implicit multiplication: 2x, 3(x+1), x sin(x)
        const l = left, r = power();
        left = (x) => l(x) * r(x);
      } else return left;
    }
  }
  function power(): Fn {
    const base = unary();
    if (peek() === "^") { next(); const e = power(); return (x) => Math.pow(base(x), e(x)); }
    return base;
  }
  function unary(): Fn {
    if (peek() === "-") { next(); const v = unary(); return (x) => -v(x); }
    if (peek() === "+") { next(); return unary(); }
    return primary();
  }
  function primary(): Fn {
    const t = next();
    if (t === undefined) throw new Error("end");
    if (/^[\d.]/.test(t)) { const n = parseFloat(t); return () => n; }
    if (t === "(") { const v = expr(); if (next() !== ")") throw new Error(")"); return v; }
    const name = t.toLowerCase();
    if (name === "x") return (x) => x;
    if (name === "pi") return () => Math.PI;
    if (name === "e") return () => Math.E;
    if (FUNCS[name]) {
      if (next() !== "(") throw new Error("(");
      const arg = expr();
      if (next() !== ")") throw new Error(")");
      return (x) => FUNCS[name](arg(x));
    }
    throw new Error("token " + t);
  }
  try {
    const f = expr();
    return i === tokens.length ? f : null;
  } catch {
    return null;
  }
}

const CURVE_COLORS = ["#fbbf24", "#60a5fa", "#f472b6", "#34d399"];

export function Graph({ d, p }: { d: any; p: number }) {
  const W = 640, H = 360, PAD = 34;
  const [x0, x1] = d.x_range ?? [-10, 10];
  const fns = (d.functions ?? []).map((f: any) => ({ ...f, fn: compileExpr(f.expr) })).filter((f: any) => f.fn);
  const samples = 240;
  const curves = fns.map((f: any) =>
    Array.from({ length: samples + 1 }, (_, k) => {
      const x = x0 + ((x1 - x0) * k) / samples;
      const y = f.fn(x);
      return { x, y: Number.isFinite(y) ? y : NaN };
    }));
  let [y0, y1] = d.y_range ?? [Infinity, -Infinity];
  if (!d.y_range) {
    curves.flat().forEach((pt: any) => { if (!isNaN(pt.y)) { y0 = Math.min(y0, pt.y); y1 = Math.max(y1, pt.y); } });
    if (!isFinite(y0)) { y0 = -10; y1 = 10; }
    const pad = (y1 - y0 || 2) * 0.1; y0 -= pad; y1 += pad;
  }
  const sx = (x: number) => PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD);
  const path = (pts: any[]) => {
    let s = "", pen = false;
    for (const pt of pts) {
      if (isNaN(pt.y) || pt.y < y0 - (y1 - y0) || pt.y > y1 + (y1 - y0)) { pen = false; continue; }
      s += `${pen ? "L" : "M"}${sx(pt.x).toFixed(1)} ${sy(pt.y).toFixed(1)} `;
      pen = true;
    }
    return s;
  };
  const draw = Math.min(1, p / 0.7);
  const ticks = (a: number, b: number) => {
    const step = Math.pow(10, Math.floor(Math.log10((b - a) / 5 || 1)));
    const m = (b - a) / step > 10 ? step * 2 : step;
    const out = []; for (let v = Math.ceil(a / m) * m; v <= b; v += m) out.push(+v.toFixed(6)); return out;
  };

  return (
    <div className="w-full h-full flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1 min-h-0 bg-white/95 rounded-xl" style={{ direction: "ltr" }}>
        {ticks(x0, x1).map((v) => <line key={"gx" + v} x1={sx(v)} x2={sx(v)} y1={PAD} y2={H - PAD} stroke="#e2e8f0" />)}
        {ticks(y0, y1).map((v) => <line key={"gy" + v} y1={sy(v)} y2={sy(v)} x1={PAD} x2={W - PAD} stroke="#e2e8f0" />)}
        {y0 <= 0 && y1 >= 0 && <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} stroke="#334155" strokeWidth={1.5} />}
        {x0 <= 0 && x1 >= 0 && <line y1={PAD} y2={H - PAD} x1={sx(0)} x2={sx(0)} stroke="#334155" strokeWidth={1.5} />}
        {ticks(x0, x1).map((v) => <text key={"tx" + v} x={sx(v)} y={H - PAD + 14} fontSize={10} textAnchor="middle" fill="#64748b">{v}</text>)}
        {ticks(y0, y1).map((v) => <text key={"ty" + v} x={PAD - 4} y={sy(v) + 3} fontSize={10} textAnchor="end" fill="#64748b">{v}</text>)}
        {curves.map((pts: any[], k: number) => (
          <path key={k} d={path(pts)} fill="none" stroke={CURVE_COLORS[k % 4]} strokeWidth={3} strokeLinecap="round"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} style={{ transition: "stroke-dashoffset .4s linear" }} />
        ))}
        {(d.points ?? []).map((pt: any, k: number) => p > 0.7 && (
          <g key={"pt" + k}>
            <circle cx={sx(pt.x)} cy={sy(pt.y)} r={6} fill="#ef4444" stroke="white" strokeWidth={2} />
            {pt.label && <text x={sx(pt.x) + 9} y={sy(pt.y) - 9} fontSize={13} fill="#0f172a" fontWeight="bold">{pt.label}</text>}
          </g>
        ))}
        {d.x_label && <text x={W - PAD} y={H - 6} fontSize={12} textAnchor="end" fill="#0f172a">{d.x_label}</text>}
        {d.y_label && <text x={PAD + 4} y={PAD - 10} fontSize={12} fill="#0f172a">{d.y_label}</text>}
      </svg>
      <div className="flex flex-wrap gap-3 justify-center text-[clamp(.65rem,1.5vw,.9rem)]">
        {fns.map((f: any, k: number) => (
          <span key={k} className="flex items-center gap-1"><span className="w-3 h-1 rounded" style={{ background: CURVE_COLORS[k % 4] }} />{f.label || f.expr}</span>
        ))}
      </div>
    </div>
  );
}

export function Chart({ d, p }: { d: any; p: number }) {
  const items: any[] = d.items ?? [];
  const max = Math.max(...items.map((it) => Math.abs(it.value)), 1);
  const grow = Math.min(1, p / 0.6);
  return (
    <div className="w-full h-full flex flex-col gap-2">
      {d.title && <p className="text-center font-bold text-[clamp(.75rem,1.8vw,1.1rem)]">{d.title}</p>}
      <div className="flex-1 min-h-0 flex items-end justify-center gap-[2%] px-2">
        {items.map((it, k) => (
          <div key={k} className="flex-1 max-w-[5rem] h-full flex flex-col items-center justify-end gap-1">
            <span className={clsx("text-[clamp(.6rem,1.4vw,.85rem)] font-bold transition-opacity", grow > 0.95 ? "opacity-100" : "opacity-0")}>
              {it.value.toLocaleString()}
            </span>
            <div className="w-full rounded-t-lg transition-all duration-500"
              style={{ height: `${(Math.abs(it.value) / max) * 75 * grow}%`, background: CURVE_COLORS[k % 4] }} />
            <span className="text-[clamp(.55rem,1.3vw,.8rem)] text-center leading-tight line-clamp-2">{it.label}</span>
          </div>
        ))}
      </div>
      {d.unit && <p className="text-center text-xs opacity-70">{d.unit}</p>}
    </div>
  );
}

export function Timeline({ d, p }: { d: any; p: number }) {
  const events: any[] = d.events ?? [];
  const active = Math.min(events.length - 1, Math.floor(p * events.length));
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="relative flex justify-between items-start px-2">
        <div className="absolute top-3 inset-x-4 h-1 bg-white/25 rounded-full" />
        <div className="absolute top-3 start-4 h-1 bg-amber-300 rounded-full transition-all duration-500"
          style={{ width: `calc(${(active / Math.max(1, events.length - 1)) * 100}% - 2rem)` }} />
        {events.map((ev, k) => (
          <div key={k} className="relative flex flex-col items-center flex-1 min-w-0">
            <span className={clsx("w-7 h-7 rounded-full border-4 transition-all duration-500 z-10",
              k === active ? "bg-amber-300 border-white scale-125" : k < active ? "bg-amber-300 border-amber-300" : "bg-slate-700 border-white/40")} />
            <span className={clsx("mt-2 font-mono font-bold text-[clamp(.6rem,1.5vw,.95rem)]", k <= active ? "opacity-100" : "opacity-40")}>{ev.date}</span>
            <span className={clsx("text-[clamp(.55rem,1.3vw,.8rem)] text-center leading-tight px-1", k <= active ? "opacity-100" : "opacity-40")}>{ev.label}</span>
          </div>
        ))}
      </div>
      {events[active]?.detail && (
        <div key={active} className="mx-auto max-w-xl rounded-xl bg-black/25 px-4 py-2 text-center text-[clamp(.7rem,1.6vw,1rem)] animate-scene-in">
          <b className="text-amber-300">{events[active].date}</b> — {events[active].detail}
        </div>
      )}
    </div>
  );
}

export function MapVisual({ d, p }: { d: any; p: number }) {
  const places: any[] = d.places ?? [];
  const shown = places.length ? Math.min(places.length - 1, Math.floor(p * places.length)) : -1;
  const focus = shown >= 0 && p > 0.25 ? places[shown] : { lat: d.lat, lon: d.lon, name: d.label };
  const span = 360 / Math.pow(2, d.zoom ?? 5);
  const bbox = [focus.lon - span, focus.lat - span / 2, focus.lon + span, focus.lat + span / 2].map((v) => v.toFixed(4)).join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${focus.lat},${focus.lon}`;
  return (
    <div className="w-full h-full flex flex-col gap-1.5">
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white relative">
        <iframe key={src} src={src} className="w-full h-full border-0 pointer-events-none" loading="lazy" title={focus.name || d.label} />
        {focus.name && <span className="absolute top-2 start-2 bg-slate-900/80 rounded-lg px-2 py-1 text-xs font-bold">📍 {focus.name}</span>}
      </div>
      {places.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {places.map((pl, k) => (
            <span key={k} className={clsx("text-[10px] sm:text-xs px-2 py-0.5 rounded-full border", k === shown && p > 0.25 ? "bg-amber-300 text-slate-900 border-amber-300" : "border-white/30 opacity-80")}>{pl.name}</span>
          ))}
        </div>
      )}
      <span className="text-[9px] opacity-60 text-center" dir="ltr">© OpenStreetMap contributors</span>
    </div>
  );
}

export function Comparison({ d, p }: { d: any; p: number }) {
  const rows: any[] = d.rows ?? [];
  const shown = Math.ceil(Math.min(1, p / 0.85) * rows.length);
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/25">
      <table className="w-full text-[clamp(.6rem,1.5vw,.95rem)]">
        <thead>
          <tr className="bg-black/30">
            <th className="p-2" />
            {(d.columns ?? []).map((c: string, k: number) => <th key={k} className="p-2 font-bold text-amber-300">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className={clsx("border-t border-white/15 transition-all duration-500", k < shown ? "opacity-100" : "opacity-0", k === shown - 1 && "bg-white/10")}>
              <td className="p-2 font-bold">{r.label}</td>
              {r.values.map((v: string, j: number) => <td key={j} className="p-2 text-center">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROLE_COLORS = ["#fbbf24", "#60a5fa", "#f472b6", "#34d399", "#a78bfa", "#fb923c"];

export function Sentence({ d, p }: { d: any; p: number }) {
  const words: any[] = d.words ?? [];
  const active = Math.min(words.length - 1, Math.floor(p * words.length));
  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-4">
        {words.map((w, k) => (
          <div key={k} className="flex flex-col items-center gap-1 min-w-[3rem]">
            <span className={clsx("text-[clamp(1.1rem,3.4vw,2.3rem)] font-bold px-2 rounded-lg transition-all duration-300",
              k === active ? "bg-white text-slate-900 scale-110" : "")}
              style={{ color: k !== active && k < active ? ROLE_COLORS[k % 6] : undefined }}>
              {w.text}
            </span>
            <span className={clsx("text-[clamp(.55rem,1.3vw,.8rem)] font-semibold transition-opacity duration-300", k <= active ? "opacity-100" : "opacity-0")}
              style={{ color: ROLE_COLORS[k % 6] }}>
              {w.role}
            </span>
          </div>
        ))}
      </div>
      {words[active]?.note && (
        <div key={active} className="rounded-xl bg-black/25 px-4 py-2 text-[clamp(.7rem,1.6vw,1rem)] animate-scene-in">
          <b style={{ color: ROLE_COLORS[active % 6] }}>{words[active].text}:</b> {words[active].role} — {words[active].note}
        </div>
      )}
    </div>
  );
}

export function Definition({ d, p }: { d: any; p: number }) {
  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-3 text-center">
      <span className="text-xs bg-white/15 rounded-full px-3 py-1">🔑</span>
      <h3 className="text-[clamp(1.4rem,4.5vw,3rem)] font-extrabold text-amber-300">{d.term}</h3>
      <p className={clsx("text-[clamp(.85rem,2.2vw,1.4rem)] leading-relaxed transition-all duration-700", p > 0.15 ? "opacity-100" : "opacity-0 translate-y-2")}>{d.definition}</p>
      {d.example && (
        <p className={clsx("rounded-xl bg-black/25 px-4 py-2 text-[clamp(.7rem,1.7vw,1.05rem)] transition-all duration-700", p > 0.6 ? "opacity-100" : "opacity-0")}>
          💡 {d.example}
        </p>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

/** One activity item: a question/prompt and its (short) answer. */
export interface Item {
  q: string;
  a: string;
  options?: string[];
  hint?: string;
}

export interface Answer { i: number; correct: boolean; choice?: string; ms?: number }

export interface GameResult {
  score: number;
  correct: number;
  total: number;
  answers: Answer[];
  duration_sec: number;
}

/** Every template receives the same items and reports the same result shape. */
export interface TemplateProps {
  items: Item[];
  onFinish: (r: GameResult) => void;
  powerUps?: boolean;
  timePerQuestion?: number;
  /** Calm mode (older students): no memes, sounds or flashy effects. */
  calm?: boolean;
  /** Hard time limit for game templates, in seconds. */
  gameSeconds?: number;
}

export type TemplateKey =
  | "quiz" | "truefalse" | "wheel" | "match" | "flashcards" | "anagram"
  | "crossword" | "spellit" | "goldquest" | "teamboard" | "tower";

export const TEMPLATE_ICONS: Record<TemplateKey, string> = {
  quiz: "❓", truefalse: "✅", wheel: "🎡", match: "🔗", flashcards: "🃏", anagram: "🔤",
  crossword: "✏️", spellit: "⌨️", goldquest: "💰", teamboard: "🏆", tower: "🏰",
};

/** Templates a student can play alone (teamboard is a whole-class, one-screen game). */
export const SOLO_TEMPLATES: TemplateKey[] = ["quiz", "truefalse", "match", "flashcards", "anagram", "crossword", "spellit", "goldquest", "tower", "wheel"];
export const PRINTABLE_TEMPLATES: TemplateKey[] = ["quiz", "match", "crossword", "anagram", "flashcards", "truefalse"];

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic PRNG so printed worksheets match their answer key. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Up to 4 options for item i: its own options, or distractors from the other answers. */
export function optionsFor(items: Item[], i: number, rand: () => number = Math.random): string[] {
  const it = items[i];
  if (it.options && it.options.length >= 2) return shuffle(it.options.slice(0, 4), rand);
  const pool = shuffle([...new Set(items.map((x) => x.a).filter((a) => a !== it.a))], rand).slice(0, 3);
  return shuffle([it.a, ...pool], rand);
}

/** Items whose answer is a single word (crossword / anagram). */
export const wordItems = (items: Item[]) =>
  items
    .map((it, i) => ({ ...it, i, word: it.a.replace(/[ً-ْـ]/g, "").trim() }))
    .filter((x) => x.word && !/\s/.test(x.word) && x.word.length >= 2 && x.word.length <= 14);

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

// ── Sound (WebAudio, no files) ───────────────────────────────

let ctx: AudioContext | null = null;
const audio = () => {
  if (typeof window === "undefined") return null;
  ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
};

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, when = 0) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + when); o.stop(c.currentTime + when + dur);
}

let muted = false;
/** Calm mode silences every game sound. */
export const setMuted = (v: boolean) => { muted = v; };

export const sfx = {
  correct: () => { tone(660, 0.12, "triangle"); tone(990, 0.2, "triangle", 0.15, 0.1); },
  wrong: () => { tone(220, 0.25, "sawtooth", 0.08); },
  tick: () => tone(1200, 0.04, "square", 0.04),
  coin: () => { tone(988, 0.08, "square", 0.06); tone(1319, 0.25, "square", 0.06, 0.08); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, "triangle", 0.12, k * 0.12)),
};

/** A cheerful looping arpeggio for the live-game lobby / questions. Returns a stop function. */
export function startMusic(tempo = 0.18): () => void {
  const c = audio();
  if (!c) return () => {};
  const notes = [262, 330, 392, 523, 392, 330, 294, 349, 440, 587, 440, 349];
  let k = 0;
  const id = setInterval(() => { tone(notes[k % notes.length], tempo * 0.9, "triangle", 0.05); if (k % 4 === 0) tone(notes[k % notes.length] / 2, tempo * 2, "sine", 0.06); k++; }, tempo * 1000);
  return () => clearInterval(id);
}

/** Read text aloud with the browser's speech engine (an Arabic voice for Arabic text). */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = /[\u0600-\u06FF]/.test(text) ? "ar-EG" : "en-US";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
  return true;
}

/** Seconds left of a game-wide time limit (null when there is none); calls onEnd at zero. */
export function useCountdown(seconds: number | undefined, onEnd: () => void) {
  const [left, setLeft] = useState<number | null>(seconds ?? null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (left === null) return;
    if (left <= 0) { endRef.current(); return; }
    const id = setTimeout(() => setLeft((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return left;
}

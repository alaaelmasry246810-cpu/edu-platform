/** Crossword layout: places single-word answers on a grid so they cross,
 *  never touching side by side. `col` grows in reading direction, so an
 *  Arabic grid is simply rendered right-to-left. */

export interface Placement { word: string; clue: string; i: number; row: number; col: number; dir: "across" | "down"; number: number }
export interface Crossword { rows: number; cols: number; placements: Placement[]; letters: Record<string, string>; unplaced: number }

const key = (r: number, c: number) => `${r},${c}`;

export function generateCrossword(words: { word: string; clue: string; i: number }[], maxWords = 16): Crossword {
  const list = [...words].sort((a, b) => b.word.length - a.word.length).slice(0, maxWords);
  const grid = new Map<string, string>();
  const placed: Omit<Placement, "number">[] = [];
  let unplaced = 0;

  const fits = (w: string, r: number, c: number, dir: "across" | "down") => {
    const [dr, dc] = dir === "across" ? [0, 1] : [1, 0];
    if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1;
    let crossings = 0;
    for (let j = 0; j < w.length; j++) {
      const rr = r + dr * j, cc = c + dc * j;
      const cur = grid.get(key(rr, cc));
      if (cur !== undefined) {
        if (cur !== w[j]) return -1;
        crossings++;
      } else if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) {
        return -1; // would sit alongside another word
      }
    }
    return crossings;
  };
  const put = (w: { word: string; clue: string; i: number }, r: number, c: number, dir: "across" | "down") => {
    const [dr, dc] = dir === "across" ? [0, 1] : [1, 0];
    [...w.word].forEach((ch, j) => grid.set(key(r + dr * j, c + dc * j), ch));
    placed.push({ ...w, row: r, col: c, dir });
  };

  list.forEach((w, n) => {
    if (n === 0) return put(w, 0, 0, "across");
    let best: { r: number; c: number; dir: "across" | "down"; score: number } | null = null;
    for (const [cell, ch] of grid) {
      const [r, c] = cell.split(",").map(Number);
      [...w.word].forEach((wc, k) => {
        if (wc !== ch) return;
        for (const dir of ["across", "down"] as const) {
          const [sr, sc] = dir === "across" ? [r, c - k] : [r - k, c];
          const score = fits(w.word, sr, sc, dir);
          if (score > 0 && (!best || score > best.score)) best = { r: sr, c: sc, dir, score };
        }
      });
    }
    if (best) put(w, (best as any).r, (best as any).c, (best as any).dir);
    else unplaced++;
  });

  const minR = Math.min(...placed.map((p) => p.row)), minC = Math.min(...placed.map((p) => p.col));
  const letters: Record<string, string> = {};
  for (const [cell, ch] of grid) {
    const [r, c] = cell.split(",").map(Number);
    letters[key(r - minR, c - minC)] = ch;
  }
  const norm = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  const starts = [...new Set(norm.map((p) => key(p.row, p.col)))]
    .map((k) => k.split(",").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberOf = new Map(starts.map(([r, c], n) => [key(r, c), n + 1]));
  const rows = Math.max(...Object.keys(letters).map((k) => +k.split(",")[0])) + 1;
  const cols = Math.max(...Object.keys(letters).map((k) => +k.split(",")[1])) + 1;
  return {
    rows, cols, letters, unplaced,
    placements: norm.map((p) => ({ ...p, number: numberOf.get(key(p.row, p.col))! })).sort((a, b) => a.number - b.number),
  };
}

export const isRtlText = (s: string) => /[؀-ۿ]/.test(s);

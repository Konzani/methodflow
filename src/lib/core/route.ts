export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Dir = "r" | "l" | "t" | "b";

const STUB = 14;
const PAD = 5;
const CROSS_PENALTY = 55;

export function tidyPts(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || l.x !== p.x || l.y !== p.y) out.push(p);
  }
  return out.filter((p, i) => {
    if (i === 0 || i === out.length - 1) return true;
    const a = out[i - 1];
    const b = out[i + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

const dedupe = (pts: Pt[]): Pt[] => pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);

const port = (b: Rect, d: Dir): Pt =>
  d === "r" ? { x: b.x + b.w, y: b.y + b.h / 2 }
  : d === "l" ? { x: b.x, y: b.y + b.h / 2 }
  : d === "t" ? { x: b.x + b.w / 2, y: b.y }
  : { x: b.x + b.w / 2, y: b.y + b.h };

const step = (p: Pt, d: Dir, n: number): Pt =>
  d === "r" ? { x: p.x + n, y: p.y } : d === "l" ? { x: p.x - n, y: p.y } : d === "t" ? { x: p.x, y: p.y - n } : { x: p.x, y: p.y + n };

const hits = (a: Pt, b: Pt, r: Rect, pad: number) =>
  Math.max(a.x, b.x) > r.x - pad &&
  Math.min(a.x, b.x) < r.x + r.w + pad &&
  Math.max(a.y, b.y) > r.y - pad &&
  Math.min(a.y, b.y) < r.y + r.h + pad;

const properCross = (a: Pt, b: Pt, c: Pt, d: Pt) => {
  // Segments from the same orthogonal grid share a coordinate at real crossings; ignore
  // touches/endpoints so shared ports do not count as crossings.
  const orient = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
};

const segmentsOf = (pts: Pt[]): [Pt, Pt][] => {
  const out: [Pt, Pt][] = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  return out;
};

export type RouteOpts = {
  /** Segments of already-routed edges; crossing them is penalised (not forbidden). */
  avoid?: [Pt, Pt][];
};

function score(path: Pt[], s: Rect, t: Rect, obstacles: Rect[], penalty: number, avoid: [Pt, Pt][]): number {
  let len = 0;
  let bad = 0;
  let cross = 0;
  const segs = segmentsOf(path);
  for (let i = 0; i < segs.length; i++) {
    const [a, b] = segs[i];
    len += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (i > 0 && i < segs.length - 1) {
      for (const o of obstacles) if (hits(a, b, o, PAD)) bad++;
      if (hits(a, b, s, 2)) bad++;
      if (hits(a, b, t, 2)) bad++;
    }
    for (const [c, d] of avoid) if (properCross(a, b, c, d)) cross++;
  }
  return len + 40 * (tidyPts(path).length - 2) + 100000 * bad + CROSS_PENALTY * cross + penalty;
}

const EXIT_COST: Record<Dir, number> = { r: 0, b: 0, l: 25, t: 25 };
const ENTRY_COST: Record<Dir, number> = { t: 0, l: 0, r: 25, b: 25 };

export function route(
  s: Rect,
  t: Rect,
  obstacles: Rect[],
  xs: number[],
  ys: number[],
  exits: Dir[] = ["r", "b", "l", "t"],
  entries: Dir[] = ["t", "l", "r", "b"],
  opts: RouteOpts = {}
): { points: Pt[]; exit: Dir } {
  const avoid = opts.avoid ?? [];
  let best: { points: Pt[]; exit: Dir; cost: number } | null = null;
  for (const de of exits) {
    const a = port(s, de);
    const a2 = step(a, de, STUB);
    for (const dn of entries) {
      const b = port(t, dn);
      const b2 = step(b, dn, STUB);
      const mids: Pt[][] = [[{ x: a2.x, y: b2.y }], [{ x: b2.x, y: a2.y }]];
      if (a2.x === b2.x || a2.y === b2.y) mids.push([]);
      for (const c of xs) mids.push([{ x: c, y: a2.y }, { x: c, y: b2.y }]);
      for (const c of ys) mids.push([{ x: a2.x, y: c }, { x: b2.x, y: c }]);
      for (const m of mids) {
        const raw = dedupe([a, a2, ...m, b2, b]);
        const cost = score(raw, s, t, obstacles, EXIT_COST[de] + ENTRY_COST[dn], avoid);
        if (!best || cost < best.cost) best = { points: tidyPts(raw), exit: de, cost };
      }
    }
  }
  return { points: best!.points, exit: best!.exit };
}

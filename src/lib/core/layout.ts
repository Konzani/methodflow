import dagre from "dagre";
import { route, tidyPts } from "./route";

export type P = { x: number; y: number };
export type LabelPos = P & { anchor: "start" | "middle" | "end" };
type Box = { x: number; y: number; w: number; h: number };

type INode = { id: string; label: string; shape: string; groupId?: string; x?: number; y?: number; pinned?: boolean };
type IEdge = { id: string; source: string; target: string; label?: string };
type IGroup = { id: string; label: string };
export type IRLike = { nodes: INode[]; edges: IEdge[]; groups: IGroup[]; meta?: { density?: string; flowDirection?: string } };

type Geo = {
  nodes: Map<string, Box>;
  groups: Map<string, Box>;
  nodeGroup: Map<string, string>;
  edges: Map<string, { points: P[]; label?: LabelPos }>;
  ends: Map<string, [string, string]>;
  width: number;
  height: number;
};

const HEADER = 24;
const MARGIN = 18;
const CHAR = 6.9;
const LINE = 16;

const METRICS = {
  spacious: { vgap: 44, colGap: 68, pad: 20, groupGap: 28 },
  balanced: { vgap: 36, colGap: 60, pad: 18, groupGap: 24 },
  compact: { vgap: 30, colGap: 54, pad: 16, groupGap: 20 },
} as const;

const NBSP = " ";
const WRAP_AT: Record<string, number> = { decision: 16, terminator: 26 };

function wrapLines(label: string, maxChars: number): string[] {
  const text = label.trim().replace(/\(\s*n\s*=\s*/gi, `(n${NBSP}=${NBSP}`);
  const words: string[] = [];
  for (const w of text.split(/[ \t\r\n]+/).filter(Boolean)) {
    if (w.length <= maxChars) words.push(w);
    else for (let i = 0; i < w.length; i += maxChars) words.push(w.slice(i, i + maxChars));
  }
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return (lines.length ? lines : [""]).map((l) => l.replace(/ /g, " "));
}

export function labelLines(shape: string, label: string): string[] {
  const base = WRAP_AT[shape] ?? 24;
  const longest = Math.max(0, ...(label ?? "").split(/[ \t\r\n]+/).map((w) => w.length));
  return wrapLines(label ?? "", Math.min(Math.max(base, longest), 28));
}

export function sizeOf(n: INode): { w: number; h: number } {
  const lines = labelLines(n.shape, n.label);
  const textW = Math.max(...lines.map((l) => l.length)) * CHAR;
  if (n.shape === "decision") {
    const textH = lines.length * LINE;
    const h = Math.max(100, textH * 2 + 36);
    const k = 1 - textH / h;
    return { w: Math.max(220, Math.ceil((textW + 40) / k / 10) * 10), h };
  }
  if (n.shape === "terminator") {
    return { w: Math.max(170, Math.ceil(textW + 48)), h: Math.max(46, lines.length * LINE + 24) };
  }
  const extra = n.shape === "document" ? 8 : n.shape === "database" ? 12 : 0;
  return { w: 190, h: Math.max(54, lines.length * LINE + 22) + extra };
}

const NEG = /^(no|fail\w*|exclu\w*|reject\w*|deni\w*|denied|not|inelig\w*|below|unmet|invalid|retry|insufficient)\b/i;
const NONE = "__none";

/**
 * Effective phase membership for layout.
 *
 * Models sometimes omit `groupId` for one or two nodes. Treating those nodes as a
 * top-level pseudo-phase widens and lengthens the diagram and breaks the phase boxes.
 * Instead, attach an ungrouped node to the phase of its predecessor (then its
 * successor, then a neighbour), so it is laid out inside the workflow it belongs to.
 * The IR itself is left untouched.
 */
function effectiveGroups(ir: IRLike): Map<string, string | undefined> {
  const known = new Set(ir.groups.map((g) => g.id));
  const out = new Map<string, string | undefined>(
    ir.nodes.map((n) => [n.id, n.groupId && known.has(n.groupId) ? n.groupId : undefined])
  );
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const e of ir.edges) {
    if (!succs.has(e.source)) succs.set(e.source, []);
    if (!preds.has(e.target)) preds.set(e.target, []);
    succs.get(e.source)!.push(e.target);
    preds.get(e.target)!.push(e.source);
  }
  const mode = (ids: string[] | undefined): string | undefined => {
    const votes = new Map<string, number>();
    for (const id of ids ?? []) {
      const g = out.get(id);
      if (g) votes.set(g, (votes.get(g) ?? 0) + 1);
    }
    let best: string | undefined;
    let count = 0;
    for (const [g, c] of votes) if (c > count) { best = g; count = c; }
    return best;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const n of ir.nodes) {
      if (out.get(n.id)) continue;
      out.set(n.id, mode(preds.get(n.id)) ?? mode(succs.get(n.id)));
    }
  }
  return out;
}

export function compute(ir: IRLike): Geo {
  const M = METRICS[(ir.meta?.density as keyof typeof METRICS) ?? "balanced"] ?? METRICS.balanced;
  const nodes = ir.nodes;
  const eff = effectiveGroups(ir);
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edges = ir.edges.filter((e) => idx.has(e.source) && idx.has(e.target) && e.source !== e.target);

  const out = new Map<string, IEdge[]>();
  const inn = new Map<string, IEdge[]>();
  for (const n of nodes) { out.set(n.id, []); inn.set(n.id, []); }
  for (const e of edges) { out.get(e.source)!.push(e); inn.get(e.target)!.push(e); }

  const back = new Set<string>();
  const state = new Map<string, number>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const e of out.get(id)!) {
      const s = state.get(e.target) ?? 0;
      if (s === 1) back.add(e.id);
      else if (s === 0) visit(e.target);
    }
    state.set(id, 2);
  };
  for (const n of nodes.filter((n) => !inn.get(n.id)!.length).concat(nodes)) if (!state.get(n.id)) visit(n.id);

  const indeg = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) if (!back.has(e.id)) indeg.set(e.target, indeg.get(e.target)! + 1);
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const order: string[] = [];
  const q = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  while (q.length) {
    q.sort((a, b) => idx.get(a)! - idx.get(b)!);
    const id = q.shift()!;
    order.push(id);
    for (const e of out.get(id)!) {
      if (back.has(e.id)) continue;
      depth.set(e.target, Math.max(depth.get(e.target)!, depth.get(id)! + 1));
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) q.push(e.target);
    }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  const rank = new Map(order.map((id, i) => [id, i]));

  const gdefs = new Map(ir.groups.map((g, i) => [g.id, { g, i }]));
  const gidOf = (n: INode) => (n.groupId && gdefs.has(n.groupId) ? n.groupId : eff.get(n.id) ?? NONE);
  const members = new Map<string, INode[]>();
  for (const n of nodes) {
    const k = gidOf(n);
    if (!members.has(k)) members.set(k, []);
    members.get(k)!.push(n);
  }
  const minDepth = (k: string) => Math.min(...members.get(k)!.map((n) => depth.get(n.id)!));
  const gorder = [...members.keys()].sort(
    (a, b) => minDepth(a) - minDepth(b) || (gdefs.get(a)?.i ?? 1e9) - (gdefs.get(b)?.i ?? 1e9)
  );
  const gi = new Map<string, number>();
  gorder.forEach((k, i) => members.get(k)!.forEach((n) => gi.set(n.id, i)));
  for (const e of edges) if (!back.has(e.id) && gi.get(e.target)! < gi.get(e.source)!) back.add(e.id);

  const fwdOut = (id: string) => out.get(id)!.filter((e) => !back.has(e.id));
  const hasBackOut = (id: string) => out.get(id)!.some((e) => back.has(e.id));
  const side = new Set<string>();
  const ordered = new Map<string, IEdge[]>();
  for (const n of nodes) {
    const f = fwdOut(n.id);
    let sd: IEdge[] = [];
    if (f.length >= 2) {
      sd = f.filter((e) => NEG.test((e.label ?? "").trim()));
      if (!sd.length && n.shape === "decision") sd = [f.find((e) => hasBackOut(e.target)) ?? f[f.length - 1]];
      if (sd.length === f.length) sd = [f[f.length - 1]];
    }
    sd.forEach((e) => side.add(e.id));
    ordered.set(n.id, [...f.filter((e) => !side.has(e.id)), ...sd]);
  }
  const rankOf = (e: IEdge) => ordered.get(e.source)!.indexOf(e);

  const layer = new Map<string, number>();
  const lane = new Map<string, number>();
  const occ = new Set<string>();
  gorder.forEach((k, G) => {
    const ms = [...members.get(k)!].sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    for (const n of ms) {
      const preds = inn.get(n.id)!.filter((e) => !back.has(e.id) && gi.get(e.source) === G);
      const L = preds.length ? Math.max(...preds.map((e) => layer.get(e.source)! + 1)) : 0;
      let l = preds.length ? Math.min(...preds.map((e) => lane.get(e.source)! + Math.max(0, rankOf(e)))) : 0;
      while (occ.has(`${G}:${L}:${l}`)) l++;
      occ.add(`${G}:${L}:${l}`);
      layer.set(n.id, L);
      lane.set(n.id, l);
    }
  });
  const used = [...new Set(lane.values())].sort((a, b) => a - b);
  const dense = new Map(used.map((l, i) => [l, i]));
  for (const [id, l] of [...lane]) lane.set(id, dense.get(l)!);

  const size = new Map(nodes.map((n) => [n.id, sizeOf(n)]));
  const nLanes = Math.max(1, used.length);
  const laneW: number[] = Array(nLanes).fill(0);
  for (const n of nodes) laneW[lane.get(n.id)!] = Math.max(laneW[lane.get(n.id)!], size.get(n.id)!.w);
  const laneX: number[] = [0];
  for (let k = 1; k < nLanes; k++) laneX[k] = laneX[k - 1] + laneW[k - 1] / 2 + M.colGap + laneW[k] / 2;
  const minX = -laneW[0] / 2;
  const maxX = laneX[nLanes - 1] + laneW[nLanes - 1] / 2;

  const skip: IEdge[][] = gorder.map(() => []);
  const backIn: IEdge[][] = gorder.map(() => []);
  const backOut: IEdge[] = [];
  const longSet = new Set<string>();
  for (const e of edges) {
    const G = gi.get(e.source)!;
    if (back.has(e.id)) {
      if (gi.get(e.target) === G) backIn[G].push(e);
      else backOut.push(e);
    } else if (gi.get(e.target)! - G > 1) {
      backOut.push(e);
      longSet.add(e.id);
    } else if (
      gi.get(e.target) === G &&
      lane.get(e.source) === lane.get(e.target) &&
      layer.get(e.target)! - layer.get(e.source)! > 1
    ) {
      skip[G].push(e);
    }
  }
  const span = (e: IEdge) => Math.abs(rank.get(e.source)! - rank.get(e.target)!);
  const chIdx = new Map<string, number>();
  const assign = (list: IEdge[]) =>
    [...list].sort((a, b) => span(a) - span(b) || idx.get(a.id as never)! - idx.get(b.id as never)!).forEach((e, k) => chIdx.set(e.id, k));
  skip.forEach(assign); backIn.forEach(assign); assign(backOut);
  
  const LC = Math.max(0, ...skip.map((l) => l.length));
  const BC = Math.max(0, ...backIn.map((l) => l.length));
  const GB = backOut.length;
  const boxL = minX - (LC ? 20 + 12 * (LC - 1) + 14 : 24);
  const boxR = maxX + (BC ? 24 + 14 * (BC - 1) + 16 : 24);
  const chL = (k: number) => minX - 20 - 12 * k;
  const gIn = (k: number) => maxX + 24 + 14 * k;
  const gOut = (k: number) => boxR + 22 + 14 * k;
  const canvasR = boxR + (GB ? 22 + 14 * (GB - 1) + 14 : 0);

  const nodeBox = new Map<string, Box>();
  const groupBox = new Map<string, Box>();
  const nodeGroup = new Map<string, string>();
  const rowTop = new Map<string, number>();
  let cursor = 0;
  gorder.forEach((k, G) => {
    const ms = members.get(k)!;
    const vis = k !== NONE;
    const top = cursor;
    let y = top + (vis ? HEADER + M.pad : 0);
    const maxL = Math.max(...ms.map((n) => layer.get(n.id)!));
    for (let L = 0; L <= maxL; L++) {
      const row = ms.filter((n) => layer.get(n.id) === L);
      const rh = Math.max(0, ...row.map((n) => size.get(n.id)!.h));
      rowTop.set(`${G}:${L}`, y);
      for (const n of row) {
        const sz = size.get(n.id)!;
        nodeBox.set(n.id, { x: laneX[lane.get(n.id)!] - sz.w / 2, y: y + (rh - sz.h) / 2, w: sz.w, h: sz.h });
        if (vis) nodeGroup.set(n.id, k);
      }
      y += rh + (L < maxL ? M.vgap : 0);
    }
    const bottom = y + (vis ? M.pad : 0);
    if (vis) groupBox.set(k, { x: boxL, y: top, w: boxR - boxL, h: bottom - top });
    cursor = bottom + M.groupGap;
  });
  const totalH = cursor - M.groupGap;

  const nb = (id: string) => { const b = nodeBox.get(id)!; return { ...b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; };
  type NB = ReturnType<typeof nb>;
  const top = (b: NB): P => ({ x: b.cx, y: b.y });
  const bottom = (b: NB): P => ({ x: b.cx, y: b.y + b.h });
  const left = (b: NB): P => ({ x: b.x, y: b.cy });
  const right = (b: NB): P => ({ x: b.x + b.w, y: b.cy });
  const entryY = (id: string) => {
    const G = gi.get(id)!;
    const L = layer.get(id)!;
    return rowTop.get(`${G}:${L}`)! - (L === 0 && gorder[G] !== NONE ? M.pad / 2 : M.vgap / 2);
  };

  const routeFwd = (e: IEdge): P[] => {
    const s = nb(e.source); const t = nb(e.target);
    const sl = lane.get(e.source)!; const tl = lane.get(e.target)!;
    const same = gi.get(e.source) === gi.get(e.target);
    const my = entryY(e.target);
    if (longSet.has(e.id)) {
      const gx = gOut(chIdx.get(e.id) ?? 0);
      const sg = gi.get(e.source)!;
      const blocked = nodes.some(
        (o) => o.id !== e.source && gi.get(o.id) === sg && layer.get(o.id) === layer.get(e.source) && lane.get(o.id)! > sl
      );
      const lastRow = layer.get(e.source) === Math.max(...members.get(gorder[sg])!.map((o) => layer.get(o.id)!));
      if (blocked && lastRow) {
        const gb = groupBox.get(gorder[sg]);
        const gapY = (gb ? gb.y + gb.h : s.y + s.h) + M.groupGap / 2;
        return [bottom(s), { x: s.cx, y: gapY }, { x: gx, y: gapY }, { x: gx, y: my }, { x: t.cx, y: my }, top(t)];
      }
      return [right(s), { x: gx, y: s.cy }, { x: gx, y: my }, { x: t.cx, y: my }, top(t)];
    }
    if (side.has(e.id)) {
      const a = right(s);
      if (tl > sl && t.y > a.y) return [a, { x: t.cx, y: a.y }, top(t)];
      const ex = a.x + 28;
      return [a, { x: ex, y: a.y }, { x: ex, y: my }, { x: t.cx, y: my }, top(t)];
    }
    if (tl === sl) {
      if (same && layer.get(e.target)! - layer.get(e.source)! > 1) {
        const cx = chL(chIdx.get(e.id) ?? 0);
        return [left(s), { x: cx, y: s.cy }, { x: cx, y: t.cy }, left(t)];
      }
      return [bottom(s), top(t)];
    }
    if (tl > sl) {
      if (same) return [right(s), { x: t.cx, y: s.cy }, top(t)];
      return [bottom(s), { x: s.cx, y: my }, { x: t.cx, y: my }, top(t)];
    }
    if (same && nodeById.get(e.target)!.shape !== "decision") return [bottom(s), { x: s.cx, y: t.cy }, right(t)];
    return [bottom(s), { x: s.cx, y: my }, { x: t.cx, y: my }, top(t)];
  };

  const routeBack = (e: IEdge, avoid: [P, P][]): P[] => {
    const k = chIdx.get(e.id) ?? 0;
    const global = gi.get(e.source) !== gi.get(e.target);
    const gx = global ? gOut(k) : gIn(k);
    const sb = nodeBox.get(e.source)!;
    const tb = nodeBox.get(e.target)!;
    // Route revision/back edges around nodes and phase boxes through the side gutter,
    // instead of a fixed path that can cut straight through intervening steps.
    const obstacles = nodes.filter((o) => o.id !== e.source && o.id !== e.target).map((o) => nodeBox.get(o.id)!);
    for (const [gid, gb] of groupBox) {
      if (gid === NONE) continue;
      if (insideRect(gb, sb) || insideRect(gb, tb)) continue;
      obstacles.push(gb);
    }
    const ys = [...new Set([...rowTop.values()])].map((y) => y - M.vgap / 2);
    ys.push(entryY(e.target));
    const r = route(sb, tb, obstacles, [gx, boxR + 18 + 14 * k], ys, ["r", "b"], ["t", "l", "r", "b"], { avoid });
    return r.points;
  };

  const edgesOut = new Map<string, { points: P[]; label?: LabelPos }>();
  const ends = new Map<string, [string, string]>();
  const routed: [P, P][] = [];
  for (const e of edges) {
    const pts = back.has(e.id) ? routeBack(e, routed) : routeFwd(e);
    edgesOut.set(e.id, { points: pts, label: e.label ? labelAtPts(pts) : undefined });
    ends.set(e.id, [e.source, e.target]);
    for (let i = 1; i < pts.length; i++) routed.push([pts[i - 1], pts[i]]);
  }

  const dx = MARGIN - boxL; const dy = MARGIN;
  const mv = (b: Box): Box => ({ ...b, x: b.x + dx, y: b.y + dy });
  const mp = (p: P): P => ({ x: p.x + dx, y: p.y + dy });

  const finalNodes = new Map([...nodeBox].map(([k, b]) => [k, mv(b)] as [string, Box]));
  const finalGroups = new Map([...groupBox].map(([k, b]) => [k, mv(b)] as [string, Box]));

  return {
    nodes: finalNodes,
    groups: finalGroups,
    nodeGroup,
    edges: new Map([...edgesOut].map(([k, v]) => [k, { points: v.points.map(mp), label: v.label ? { ...v.label, ...mp(v.label) } : undefined }])),
    ends,
    width: canvasR - boxL + 2 * MARGIN,
    height: totalH + 2 * MARGIN,
  };
}

function labelAtPts(pts: P[]): LabelPos {
  // Anchor labels to the longest segment at its midpoint, offset perpendicular to the
  // line. This keeps labels off the node borders and away from short exit stubs.
  let best = 0;
  let bestLen = -1;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  if (best === 0) best = 1;
  const a = pts[best - 1];
  const b = pts[best];
  if (a.x === b.x) return { x: a.x + 8, y: (a.y + b.y) / 2, anchor: "start" };
  return { x: (a.x + b.x) / 2, y: a.y - 7, anchor: "middle" };
}

const insideRect = (r: Box, b: Box) => {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h;
};

function pathHitsNodes(pts: P[], nodes: Map<string, Box>, except: Set<string>): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    for (const [id, n] of nodes) {
      if (except.has(id)) continue;
      if (
        Math.max(a.x, b.x) > n.x &&
        Math.min(a.x, b.x) < n.x + n.w &&
        Math.max(a.y, b.y) > n.y &&
        Math.min(a.y, b.y) < n.y + n.h
      ) return true;
    }
  }
  return false;
}

const tidy = tidyPts;

function elbow(s: Box, t: Box): P[] {
  const scx = s.x + s.w / 2, scy = s.y + s.h / 2;
  const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
  if (t.x >= s.x + s.w + 8) {
    const mx = (s.x + s.w + t.x) / 2;
    return tidy([{ x: s.x + s.w, y: scy }, { x: mx, y: scy }, { x: mx, y: tcy }, { x: t.x, y: tcy }]);
  }
  if (t.x + t.w <= s.x - 8) {
    const mx = (t.x + t.w + s.x) / 2;
    return tidy([{ x: s.x, y: scy }, { x: mx, y: scy }, { x: mx, y: tcy }, { x: t.x + t.w, y: tcy }]);
  }
  if (tcy >= scy) {
    const my = (s.y + s.h + t.y) / 2;
    return tidy([{ x: scx, y: s.y + s.h }, { x: scx, y: my }, { x: tcx, y: my }, { x: tcx, y: t.y }]);
  }
  const my = (t.y + t.h + s.y) / 2;
  return tidy([{ x: scx, y: s.y }, { x: scx, y: my }, { x: tcx, y: my }, { x: tcx, y: t.y + t.h }]);
}

function fitCanvas(g: Geo): Geo {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  for (const b of [...g.nodes.values(), ...g.groups.values()]) { add(b.x, b.y); add(b.x + b.w, b.y + b.h); }
  for (const e of g.edges.values()) {
    e.points.forEach((p) => add(p.x, p.y));
    if (e.label) add(e.label.x, e.label.y);
  }
  const dx = MARGIN - x0, dy = MARGIN - y0;
  const mb = (b: Box): Box => ({ ...b, x: b.x + dx, y: b.y + dy });
  const mp = (p: P): P => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...g,
    nodes: new Map([...g.nodes].map(([k, b]) => [k, mb(b)] as [string, Box])),
    groups: new Map([...g.groups].map(([k, b]) => [k, mb(b)] as [string, Box])),
    edges: new Map(
      [...g.edges].map(([k, v]) => [k, { points: v.points.map(mp), label: v.label ? { ...v.label, ...mp(v.label) } : undefined }] as [string, { points: P[]; label?: LabelPos }])
    ),
    width: x1 - x0 + 2 * MARGIN,
    height: y1 - y0 + 2 * MARGIN,
  };
}

function placeLR(ir: IRLike): Geo {
  const M = METRICS[(ir.meta?.density as keyof typeof METRICS) ?? "balanced"] ?? METRICS.balanced;
  const ids = new Set(ir.nodes.map((n) => n.id));
  const nodeById = new Map(ir.nodes.map((n) => [n.id, n]));
  const edges = ir.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const size = new Map(ir.nodes.map((n) => [n.id, sizeOf(n)]));

  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: "LR", nodesep: M.vgap + M.pad + 14, ranksep: M.colGap + M.pad, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  const eff = effectiveGroups(ir);
  const used = new Set(ir.nodes.map((n) => eff.get(n.id)).filter(Boolean) as string[]);
  const gids = new Set(ir.groups.filter((x) => used.has(x.id)).map((x) => x.id));
  gids.forEach((id) => g.setNode("g:" + id, {}));
  for (const n of ir.nodes) {
    const s = size.get(n.id)!;
    g.setNode(n.id, { width: s.w, height: s.h });
    const gid = eff.get(n.id);
    if (gid && gids.has(gid)) g.setParent(n.id, "g:" + gid);
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const nodeBox = new Map<string, Box>();
  for (const n of ir.nodes) {
    const p = g.node(n.id);
    const s = size.get(n.id)!;
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) throw new Error("dagre failed");
    nodeBox.set(n.id, { x: p.x - s.w / 2, y: p.y - s.h / 2, w: s.w, h: s.h });
  }
  const groupBox = new Map<string, Box>();
  const nodeGroup = new Map<string, string>();
  for (const id of gids) {
    const ms = ir.nodes.filter((n) => eff.get(n.id) === id);
    const bs = ms.map((n) => nodeBox.get(n.id)!);
    const x0 = Math.min(...bs.map((b) => b.x)) - M.pad;
    const y0 = Math.min(...bs.map((b) => b.y)) - M.pad - HEADER;
    const x1 = Math.max(...bs.map((b) => b.x + b.w)) + M.pad;
    const y1 = Math.max(...bs.map((b) => b.y + b.h)) + M.pad;
    groupBox.set(id, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    ms.forEach((n) => nodeGroup.set(n.id, id));
  }
  const floor = (id: string) => {
    const b = nodeBox.get(id)!;
    const gid = nodeGroup.get(id);
    const gb = gid ? groupBox.get(gid)! : undefined;
    return Math.max(b.y + b.h, gb ? gb.y + gb.h : 0);
  };

  const edgesOut = new Map<string, { points: P[]; label?: LabelPos }>();
  const ends = new Map<string, [string, string]>();
  const exits = new Map<string, Set<string>>();
  let loop = 0;
  for (const e of edges) {
    const s = nodeBox.get(e.source)!;
    const t = nodeBox.get(e.target)!;
    const scx = s.x + s.w / 2, scy = s.y + s.h / 2, tcy = t.y + t.h / 2;
    let pts: P[];
    if (t.x >= s.x + s.w + 4) {
      let exit = "r";
      if (nodeById.get(e.source)!.shape === "decision") {
        const taken = exits.get(e.source) ?? new Set<string>();
        exits.set(e.source, taken);
        const pref = tcy < s.y - 6 ? ["t", "r", "b"] : tcy > s.y + s.h + 6 ? ["b", "r", "t"] : ["r", "t", "b"];
        exit = pref.find((x) => !taken.has(x)) ?? "r";
        taken.add(exit);
      }
      if (exit === "t") pts = tidy([{ x: scx, y: s.y }, { x: scx, y: tcy }, { x: t.x, y: tcy }]);
      else if (exit === "b") pts = tidy([{ x: scx, y: s.y + s.h }, { x: scx, y: tcy }, { x: t.x, y: tcy }]);
      else pts = elbow(s, t);
    } else if (t.x + t.w > s.x - 4) {
      pts = elbow(s, t);
    } else {
      const ly = Math.max(floor(e.source), floor(e.target)) + 16 + 12 * loop++;
      const tcx = t.x + t.w / 2;
      pts = tidy([{ x: scx, y: s.y + s.h }, { x: scx, y: ly }, { x: tcx, y: ly }, { x: tcx, y: t.y + t.h }]);
    }
    edgesOut.set(e.id, { points: pts, label: e.label ? labelAtPts(pts) : undefined });
    ends.set(e.id, [e.source, e.target]);
  }
  return fitCanvas({ nodes: nodeBox, groups: groupBox, nodeGroup, edges: edgesOut, ends, width: 0, height: 0 });
}

/**
 * Dagre-based top-to-bottom layout. Its rank constraints put sibling phases that share a
 * predecessor side by side (e.g. the satellite/terrain/ground evidence strands), which the
 * single-column custom engine stacks vertically. Every edge is re-routed by the orthogonal
 * router so the output keeps the clean-arrow guarantees.
 */
export function placeDagreTB(ir: IRLike, alignBands = false): Geo | null {
  const M = METRICS[(ir.meta?.density as keyof typeof METRICS) ?? "balanced"] ?? METRICS.balanced;
  const ids = new Set(ir.nodes.map((n) => n.id));
  const edges = ir.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  if (!edges.length) return null;
  const size = new Map(ir.nodes.map((n) => [n.id, sizeOf(n)]));
  const eff = effectiveGroups(ir);
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: "TB", nodesep: M.colGap, ranksep: M.vgap + M.pad, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  const used = new Set(ir.nodes.map((n) => eff.get(n.id)).filter(Boolean) as string[]);
  const gids = new Set(ir.groups.filter((x) => used.has(x.id)).map((x) => x.id));
  gids.forEach((id) => g.setNode("g:" + id, {}));
  for (const n of ir.nodes) {
    const s = size.get(n.id)!;
    g.setNode(n.id, { width: s.w, height: s.h });
    const gid = eff.get(n.id);
    if (gid && gids.has(gid)) g.setParent(n.id, "g:" + gid);
  }
  for (const e of edges) g.setEdge(e.source, e.target);
  try {
    dagre.layout(g);
  } catch {
    return null;
  }
  const nodeBox = new Map<string, Box>();
  for (const n of ir.nodes) {
    const p = g.node(n.id);
    const s = size.get(n.id)!;
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return null;
    nodeBox.set(n.id, { x: p.x - s.w / 2, y: p.y - s.h / 2, w: s.w, h: s.h });
  }
  const groupBox = new Map<string, Box>();
  const nodeGroup = new Map<string, string>();
  for (const id of gids) {
    const ms = ir.nodes.filter((n) => eff.get(n.id) === id);
    const bs = ms.map((n) => nodeBox.get(n.id)).filter(Boolean) as Box[];
    if (!bs.length) continue;
    const x0 = Math.min(...bs.map((b) => b.x)) - M.pad;
    const y0 = Math.min(...bs.map((b) => b.y)) - M.pad - HEADER;
    const x1 = Math.max(...bs.map((b) => b.x + b.w)) + M.pad;
    const y1 = Math.max(...bs.map((b) => b.y + b.h)) + M.pad;
    groupBox.set(id, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    ms.forEach((n) => nodeGroup.set(n.id, id));
  }
  if (alignBands) {
    // Align sibling phases that belong to the same vertical band (shared predecessor, no
    // edges between them) so parallel evidence strands read as aligned columns.
    type Band = { ids: string[]; y0: number; y1: number };
    const bands: Band[] = [];
    for (const [id, b] of [...groupBox.entries()].sort((a, b) => a[1].y - b[1].y)) {
      let placed = false;
      for (const band of bands) {
        const overlap = Math.min(band.y1, b.y + b.h) - Math.max(band.y0, b.y);
        if (overlap > 0.35 * Math.min(band.y1 - band.y0, b.h)) {
          band.ids.push(id);
          band.y0 = Math.min(band.y0, b.y);
          band.y1 = Math.max(band.y1, b.y + b.h);
          placed = true;
          break;
        }
      }
      if (!placed) bands.push({ ids: [id], y0: b.y, y1: b.y + b.h });
    }
    for (const band of bands) {
      for (const id of band.ids) {
        const dy = band.y0 - groupBox.get(id)!.y;
        if (!dy) continue;
        groupBox.get(id)!.y += dy;
        for (const n of ir.nodes) {
          if (eff.get(n.id) === id) nodeBox.get(n.id)!.y += dy;
        }
      }
    }
  }
  const xs: number[] = [MARGIN / 2];
  const gbSorted = [...groupBox.values()].sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < gbSorted.length; i++) {
    const a = gbSorted[i];
    const b = gbSorted[i + 1];
    if (b.x - (a.x + a.w) > 8) xs.push((a.x + a.w + b.x) / 2);
  }
  const right = Math.max(
    ...[...groupBox.values()].map((r) => r.x + r.w),
    ...[...nodeBox.values()].map((b) => b.x + b.w)
  );
  xs.push(right + 24);
  const bands = [...nodeBox.values()].map((b) => ({ y0: b.y, y1: b.y + b.h })).sort((a, b) => a.y0 - b.y0);
  const ys: number[] = [MARGIN / 2];
  let bottom = bands.length ? bands[0].y1 : 0;
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].y0 > bottom + 8) ys.push((bottom + bands[i].y0) / 2);
    bottom = Math.max(bottom, bands[i].y1);
  }
  ys.push(bottom + 14);

  const nodeById = new Map(ir.nodes.map((n) => [n.id, n]));
  const taken = new Map<string, Set<string>>();
  const labelled = new Set(ir.edges.filter((e) => e.label).map((e) => e.id));
  const edgesOut = new Map<string, { points: P[]; label?: LabelPos }>();
  const ends = new Map<string, [string, string]>();
  const routed: [P, P][] = [];
  const allExits: ("r" | "b" | "l" | "t")[] = ["r", "b", "l", "t"];
  for (const e of edges) {
    const sb = nodeBox.get(e.source)!;
    const tb = nodeBox.get(e.target)!;
    const obstacles = [...nodeBox.entries()].filter(([id]) => id !== e.source && id !== e.target).map(([, b]) => b);
    for (const [, gb] of groupBox) if (!insideRect(gb, sb) && !insideRect(gb, tb)) obstacles.push(gb);
    let used = taken.get(e.source);
    if (nodeById.get(e.source)?.shape === "decision") {
      used = used ?? new Set<string>();
      taken.set(e.source, used);
    }
    const r = route(sb, tb, obstacles, xs, ys, used ? allExits.filter((d) => !used!.has(d)) : allExits, undefined, { avoid: routed });
    used?.add(r.exit);
    edgesOut.set(e.id, { points: r.points, label: labelled.has(e.id) ? labelAtPts(r.points) : undefined });
    ends.set(e.id, [e.source, e.target]);
    for (let i = 1; i < r.points.length; i++) routed.push([r.points[i - 1], r.points[i]]);
  }
  return fitCanvas({ nodes: nodeBox, groups: groupBox, nodeGroup, edges: edgesOut, ends, width: 0, height: 0 });
}

export type FitBox = { w: number; h: number };

/**
 * Page-fit score. Without a hint it targets the A4 content box in either orientation
 * (the historical behaviour). Callers that know the export page pass one or more content
 * boxes in px so folding/row-wrapping optimises for the page actually being printed.
 */
export const pageScore = (w: number, h: number, boxes?: FitBox[]) =>
  boxes && boxes.length
    ? Math.max(...boxes.map((b) => Math.min(1, b.w / w, b.h / h)))
    : Math.max(Math.min(1, 642 / w, 918 / h), Math.min(1, 971 / w, 590 / h));
const fitScale = (g: Geo, boxes?: FitBox[]) => pageScore(g.width, g.height, boxes);

function splits(n: number, k: number): number[][] {
  if (k === 1) return [[n]];
  const out: number[][] = [];
  for (let first = 1; first <= n - (k - 1); first++) for (const rest of splits(n - first, k - 1)) out.push([first, ...rest]);
  return out;
}

export function foldGeo(ir: IRLike, geo: Geo, k: number, boxes?: FitBox[]): Geo | null {
  // A node with no groupId is still a layout segment (unboxed, no phase header).
  // Treating it as an extra segment keeps folding available instead of silently
  // disabling page fitting for a whole diagram.
  const segOf = (id: string) => geo.nodeGroup.get(id) ?? NONE;
  // Only nodes that no boxed phase claimed remain ungrouped; nodes the model forgot
  // to group are attached to a phase by effectiveGroups() before this point.
  const unplaced = ir.nodes.filter((n) => !geo.nodeGroup.has(n.id));
  const segTop = (seg: string) =>
    seg === NONE
      ? Math.min(...unplaced.map((n) => geo.nodes.get(n.id)?.y ?? 0)) - 8
      : geo.groups.get(seg)!.y;
  const order = [...geo.groups.keys(), ...(unplaced.length ? [NONE] : [])].sort((a, b) => segTop(a) - segTop(b));
  if (order.length < k) return null;
  const gap = 48;

  const extent = new Map<string, { x0: number; x1: number; y0: number; h: number }>();
  const tight = new Map<string, Box>();
  const PADX = 20;
  for (const seg of order) {
    const members = ir.nodes.filter((n) => segOf(n.id) === seg).map((n) => geo.nodes.get(n.id)!).filter(Boolean);
    if (!members.length) return null;
    const b = seg === NONE ? undefined : geo.groups.get(seg);
    let x0 = Math.min(...members.map((m) => m.x)) - PADX;
    let x1 = Math.max(...members.map((m) => m.x + m.w)) + PADX;
    let y0 = b ? b.y : Math.min(...members.map((m) => m.y)) - 8;
    let bottom = b ? b.y + b.h : Math.max(...members.map((m) => m.y + m.h)) + 8;
    for (const [id, [s, t]] of geo.ends) {
      if (segOf(s) !== seg || segOf(t) !== seg) continue;
      for (const p of geo.edges.get(id)!.points) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        bottom = Math.max(bottom, p.y);
      }
    }
    extent.set(seg, { x0, x1, y0, h: bottom - y0 });
    if (b) tight.set(seg, { x: x0, y: y0, w: x1 - x0, h: bottom - y0 });
  }
  const heightOf = (ids: string[]) =>
    Math.max(...ids.map((g) => extent.get(g)!.y0 + extent.get(g)!.h)) - Math.min(...ids.map((g) => extent.get(g)!.y0));
  const widthOf = (ids: string[]) => Math.max(...ids.map((g) => extent.get(g)!.x1)) - Math.min(...ids.map((g) => extent.get(g)!.x0));

  let best: string[][] | null = null;
  let bestScore = -1;
  for (const sp of splits(order.length, k)) {
    let i = 0;
    const cols = sp.map((c) => order.slice(i, (i += c)));
    const w = cols.reduce((a, c) => a + widthOf(c), 0) + gap * (cols.length - 1);
    const h = Math.max(...cols.map(heightOf));
    const sc = pageScore(w + 2 * MARGIN, h + 2 * MARGIN, boxes);
    if (sc > bestScore) {
      bestScore = sc;
      best = cols;
    }
  }
  if (!best) return null;

  const shift = new Map<string, P>();
  const colX: number[] = [];
  let cursor = MARGIN;
  best.forEach((ids) => {
    const left = Math.min(...ids.map((g) => extent.get(g)!.x0));
    const top = Math.min(...ids.map((g) => extent.get(g)!.y0));
    colX.push(cursor);
    ids.forEach((seg) => shift.set(seg, { x: cursor - left, y: MARGIN - top }));
    cursor += widthOf(ids) + gap;
  });
  const mv = (b: Box, d: P): Box => ({ ...b, x: b.x + d.x, y: b.y + d.y });
  const nodes = new Map<string, Box>();
  for (const [id, b] of geo.nodes) nodes.set(id, mv(b, shift.get(segOf(id))!));
  const groups = new Map<string, Box>();
  for (const [seg] of geo.groups) groups.set(seg, mv(tight.get(seg)!, shift.get(seg)!));
  const placed = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (const seg of order) {
    const e = extent.get(seg)!;
    const d = shift.get(seg)!;
    placed.set(seg, { x0: e.x0 + d.x, y0: e.y0 + d.y, x1: e.x1 + d.x, y1: e.y0 + d.y + e.h });
  }

  const gutters: number[] = [];
  for (let ci = 1; ci < best.length; ci++) gutters.push(colX[ci] - gap / 2);
  const ys: number[] = [MARGIN / 2];
  for (const ids of best)
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = placed.get(ids[i])!;
      const b = placed.get(ids[i + 1])!;
      ys.push((a.y1 + b.y0) / 2);
    }
  ys.push(Math.max(...[...placed.values()].map((p) => p.y1)) + 14);

  const nodeById = new Map(ir.nodes.map((n) => [n.id, n]));
  const taken = new Map<string, Set<string>>();
  const lanes = new Map<number, number>();
  const routed: [P, P][] = [];
  const edges = new Map<string, { points: P[]; label?: LabelPos }>();
  const labelled = new Set(ir.edges.filter((e) => e.label).map((e) => e.id));
  for (const [id, [s, t]] of geo.ends) {
    const gs = segOf(s);
    const gt = segOf(t);
    let pts: P[] | null = null;
    if (gs === gt) {
      const d = shift.get(gs)!;
      const moved = geo.edges.get(id)!.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y }));
      if (!pathHitsNodes(moved, nodes, new Set([s, t]))) pts = moved;
    }
    if (!pts) {
      const sb = nodes.get(s)!;
      const tb = nodes.get(t)!;
      const obstacles = [...nodes.entries()].filter(([nid]) => nid !== s && nid !== t).map(([, b]) => b);
      for (const [gid, gb] of groups) if (!insideRect(gb, sb) && !insideRect(gb, tb)) obstacles.push(gb);
      const exits: ("r" | "b" | "l" | "t")[] = ["r", "b", "l", "t"];
      let used = taken.get(s);
      if (nodeById.get(s)!.shape === "decision") {
        used = used ?? new Set<string>();
        taken.set(s, used);
      }
      const xs = gutters.map((g) => g + 10 * (lanes.get(g) ?? 0));
      const r = route(sb, tb, obstacles, xs, ys, used ? exits.filter((x) => !used!.has(x)) : exits, undefined, { avoid: routed });
      used?.add(r.exit);
      gutters.forEach((g, gi) => {
        if (r.points.some((p, i) => i > 0 && p.x === xs[gi] && r.points[i - 1].x === xs[gi] && p.y !== r.points[i - 1].y)) lanes.set(g, (lanes.get(g) ?? 0) + 1);
      });
      pts = r.points;
    }
    edges.set(id, { points: pts, label: labelled.has(id) ? labelAtPts(pts) : undefined });
    for (let i = 1; i < pts.length; i++) routed.push([pts[i - 1], pts[i]]);
  }
  return fitCanvas({ nodes, groups, nodeGroup: geo.nodeGroup, edges, ends: geo.ends, width: 0, height: 0 });
}

export function foldCandidate(ir: IRLike, tb: Geo, boxes?: FitBox[]): Geo | null {
  let best: Geo | null = null;
  let bestScale = fitScale(tb, boxes) * 1.1;
  const maxK = Math.min(5, new Set(ir.nodes.map((n) => n.groupId)).size);
  for (let k = 2; k <= maxK; k++) {
    const g = foldGeo(ir, tb, k, boxes);
    if (g && fitScale(g, boxes) > bestScale) {
      best = g;
      bestScale = fitScale(g, boxes);
    }
  }
  return best;
}

/**
 * Page-aware row folding for left-to-right flows.
 *
 * A plain dagre LR layout is one very wide row, which is unusable on paper. Here the
 * phase groups keep their internal left-to-right flow but are wrapped into consecutive
 * page-width rows; cross-row edges are re-routed orthogonally around nodes.
 */
export function foldRowsGeo(ir: IRLike, lr: Geo, k: number, boxes?: FitBox[]): Geo | null {
  const PADX = 20;
  const gap = 48;
  const ROWGAP = 36;
  const segOf = (id: string) => lr.nodeGroup.get(id) ?? NONE;
  const unplaced = ir.nodes.filter((n) => !lr.nodeGroup.has(n.id));
  const segLeft = (seg: string) =>
    seg === NONE
      ? Math.min(...unplaced.map((n) => lr.nodes.get(n.id)?.x ?? 0)) - 8
      : lr.groups.get(seg)!.x;
  const order = [...lr.groups.keys(), ...(unplaced.length ? [NONE] : [])].sort((a, b) => segLeft(a) - segLeft(b));
  if (order.length < k) return null;

  const extent = new Map<string, { x0: number; x1: number; y0: number; h: number }>();
  for (const seg of order) {
    const members = ir.nodes.filter((n) => segOf(n.id) === seg).map((n) => lr.nodes.get(n.id)).filter(Boolean) as Box[];
    if (!members.length) return null;
    const gb = seg === NONE ? undefined : lr.groups.get(seg);
    let x0 = Math.min(...members.map((b) => b.x)) - PADX;
    let x1 = Math.max(...members.map((b) => b.x + b.w)) + PADX;
    let y0 = gb ? gb.y : Math.min(...members.map((b) => b.y)) - 8;
    let bottom = gb ? gb.y + gb.h : Math.max(...members.map((b) => b.y + b.h)) + 8;
    for (const [id, [s, t]] of lr.ends) {
      if (segOf(s) !== seg || segOf(t) !== seg) continue;
      for (const p of lr.edges.get(id)!.points) {
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        y0 = Math.min(y0, p.y);
        bottom = Math.max(bottom, p.y);
      }
    }
    extent.set(seg, { x0, x1, y0, h: bottom - y0 });
  }
  const widthOf = (ids: string[]) =>
    ids.reduce((a, gid) => a + (extent.get(gid)!.x1 - extent.get(gid)!.x0), 0) + gap * Math.max(0, ids.length - 1);
  const heightOf = (ids: string[]) => Math.max(...ids.map((gid) => extent.get(gid)!.h));

  let best: string[][] | null = null;
  let bestScore = -1;
  for (const sp of splits(order.length, k)) {
    let i = 0;
    const rows = sp.map((c) => order.slice(i, (i += c)));
    const w = Math.max(...rows.map(widthOf));
    const h = rows.reduce((a, r) => a + heightOf(r), 0) + ROWGAP * (rows.length - 1);
    const sc = pageScore(w + 2 * MARGIN, h + 2 * MARGIN, boxes);
    if (sc > bestScore) {
      bestScore = sc;
      best = rows;
    }
  }
  if (!best) return null;

  const shift = new Map<string, P>();
  const rowTop: number[] = [];
  let cursorY = MARGIN;
  for (const ids of best) {
    let cursorX = MARGIN;
    rowTop.push(cursorY);
    for (const seg of ids) {
      const e = extent.get(seg)!;
      shift.set(seg, { x: cursorX - e.x0, y: cursorY - e.y0 });
      cursorX += e.x1 - e.x0 + gap;
    }
    cursorY += heightOf(ids) + ROWGAP;
  }

  const mv = (b: Box, d: P): Box => ({ ...b, x: b.x + d.x, y: b.y + d.y });
  const nodes = new Map<string, Box>();
  for (const [id, b] of lr.nodes) nodes.set(id, mv(b, shift.get(segOf(id))!));
  const groups = new Map<string, Box>();
  for (const seg of lr.groups.keys()) {
    const e = extent.get(seg)!;
    const d = shift.get(seg)!;
    groups.set(seg, { x: e.x0 + d.x, y: e.y0 + d.y, w: e.x1 - e.x0, h: e.h });
  }
  const placed = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  for (const seg of order) {
    const e = extent.get(seg)!;
    const d = shift.get(seg)!;
    placed.set(seg, { x0: e.x0 + d.x, y0: e.y0 + d.y, x1: e.x1 + d.x, y1: e.y0 + d.y + e.h });
  }

  // Candidate channels: gutters between segments inside each row, row gutters,
  // and outer margins. The router picks the cheapest orthogonal path through them.
  const xs: number[] = [MARGIN / 2];
  for (const ids of best) {
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = placed.get(ids[i])!;
      const b = placed.get(ids[i + 1])!;
      xs.push((a.x1 + b.x0) / 2);
    }
  }
  const ys: number[] = [MARGIN / 2];
  for (let i = 0; i + 1 < best.length; i++) ys.push(rowTop[i] + heightOf(best[i]) + ROWGAP / 2);
  const rightmost = Math.max(...[...placed.values()].map((p) => p.x1));
  xs.push(rightmost + 24);

  const nodeById = new Map(ir.nodes.map((n) => [n.id, n]));
  const taken = new Map<string, Set<string>>();
  const labelled = new Set(ir.edges.filter((e) => e.label).map((e) => e.id));
  const routed: [P, P][] = [];
  const edges = new Map<string, { points: P[]; label?: LabelPos }>();
  const allExits: ("r" | "b" | "l" | "t")[] = ["r", "b", "l", "t"];
  for (const [id, [s, t]] of lr.ends) {
    const gs = segOf(s);
    const gt = segOf(t);
    let pts: P[] | null = null;
    if (gs === gt) {
      const d = shift.get(gs)!;
      const moved = lr.edges.get(id)!.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y }));
      if (!pathHitsNodes(moved, nodes, new Set([s, t]))) pts = moved;
    }
    if (!pts) {
      const sb = nodes.get(s)!;
      const tb = nodes.get(t)!;
      const obstacles = [...nodes.entries()].filter(([nid]) => nid !== s && nid !== t).map(([, b]) => b);
      for (const [gid, gb] of groups) if (!insideRect(gb, sb) && !insideRect(gb, tb)) obstacles.push(gb);
      let used = taken.get(s);
      if (nodeById.get(s)!.shape === "decision") {
        used = used ?? new Set<string>();
        taken.set(s, used);
      }
      const r = route(sb, tb, obstacles, xs, ys, used ? allExits.filter((d) => !used!.has(d)) : allExits, undefined, { avoid: routed });
      used?.add(r.exit);
      pts = r.points;
    }
    edges.set(id, { points: pts, label: labelled.has(id) ? labelAtPts(pts) : undefined });
    for (let i = 1; i < pts.length; i++) routed.push([pts[i - 1], pts[i]]);
  }
  return fitCanvas({ nodes, groups, nodeGroup: lr.nodeGroup, edges, ends: lr.ends, width: 0, height: 0 });
}

function rowFoldCandidate(ir: IRLike, lr: Geo, boxes?: FitBox[]): Geo | null {
  let best: Geo | null = null;
  let bestScale = fitScale(lr, boxes) * 1.06;
  const maxK = Math.min(4, new Set(ir.nodes.map((n) => n.groupId)).size);
  for (let k = 2; k <= maxK; k++) {
    const g = foldRowsGeo(ir, lr, k, boxes);
    if (g) {
      const s = fitScale(g, boxes);
      if (s > bestScale) {
        best = g;
        bestScale = s;
      }
    }
  }
  return best;
}

function place(ir: IRLike, boxes?: FitBox[]): Geo {
  const dir = ir.meta?.flowDirection ?? "auto";
  const lr = () => {
    try { return placeLR(ir); } catch { return null; }
  };
  const tb = compute(ir);
  if (dir === "lr") {
    const l = lr() ?? tb;
    // A raw LR flow is a single very wide row; wrap it into page-width rows when
    // that materially improves the printed size.
    return ir.nodes.length >= 8 && fitScale(l, boxes) < 0.8 ? rowFoldCandidate(ir, l, boxes) ?? l : l;
  }
  if (dir === "branches") {
    // Clarity-first option: parallel phases as aligned columns, all edges re-routed.
    return placeDagreTB(ir, true) ?? tb;
  }
  if (dir !== "auto" || ir.nodes.length < 8 || fitScale(tb, boxes) >= 0.85) return tb;
  const candidates: Geo[] = [foldCandidate(ir, tb, boxes) ?? tb];
  const dg = placeDagreTB(ir);
  if (dg) candidates.push(dg);
  const l = lr();
  if (l) {
    candidates.push(l);
    const rf = rowFoldCandidate(ir, l, boxes);
    if (rf) candidates.push(rf);
  }
  let best = candidates[0];
  let bestScale = fitScale(best, boxes);
  for (const c of candidates.slice(1)) {
    const s = fitScale(c, boxes);
    if (s > bestScale * 1.04) {
      best = c;
      bestScale = s;
    }
  }
  return best;
}

function applyPins(ir: IRLike, geo: Geo): Geo {
  const pinned = ir.nodes.filter((n) => n.pinned && Number.isFinite(n.x) && Number.isFinite(n.y) && geo.nodes.has(n.id));
  if (!pinned.length) return geo;
  const nodes = new Map(geo.nodes);
  for (const n of pinned) nodes.set(n.id, { ...nodes.get(n.id)!, x: n.x as number, y: n.y as number });
  const touched = new Set(pinned.map((n) => n.id));
  const labelled = new Set(ir.edges.filter((e) => e.label).map((e) => e.id));
  const edges = new Map(geo.edges);
  for (const [id, [s, t]] of geo.ends) {
    if (!touched.has(s) && !touched.has(t)) continue;
    const pts = elbow(nodes.get(s)!, nodes.get(t)!);
    edges.set(id, { points: pts, label: labelled.has(id) ? labelAtPts(pts) : undefined });
  }
  const groups = new Map(geo.groups);
  for (const [nid, gid] of geo.nodeGroup) {
    if (!touched.has(nid)) continue;
    const gb = groups.get(gid);
    if (!gb) continue;
    const b = nodes.get(nid)!;
    const x0 = Math.min(gb.x, b.x - 16);
    const y0 = Math.min(gb.y, b.y - HEADER - 12);
    const x1 = Math.max(gb.x + gb.w, b.x + b.w + 16);
    const y1 = Math.max(gb.y + gb.h, b.y + b.h + 16);
    groups.set(gid, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  const nodeBoxes = [...nodes.entries()];
  const xs = [...new Set(nodeBoxes.map(([, b]) => Math.round(b.x + b.w / 2)))];
  const ys = [...new Set(nodeBoxes.map(([, b]) => Math.round(b.y + b.h / 2)))];
  for (const [id, [s, t]] of geo.ends) {
    if (!touched.has(s) && !touched.has(t)) continue;
    const sb = nodes.get(s)!;
    const tb = nodes.get(t)!;
    const obstacles = nodeBoxes.filter(([nid]) => nid !== s && nid !== t).map(([, b]) => b);
    for (const [, gb] of groups) if (!insideRect(gb, sb) && !insideRect(gb, tb)) obstacles.push(gb);
    const r = route(sb, tb, obstacles, xs, ys);
    edges.set(id, { points: r.points, label: labelled.has(id) ? labelAtPts(r.points) : undefined });
  }
  return fitCanvas({ ...geo, nodes, edges, groups });
}

type PortRef = { edge: string; end: "s" | "t"; node: string; side: "r" | "l" | "t" | "b"; pos: P; adj: P; coord: number };

/** Give edges that meet the same node side distinct attachment points, so arrowheads do
 *  not stack on one pixel and short stubs cannot overlap. */
function spreadPorts(geo: Geo): Geo {
  const refs: PortRef[] = [];
  const sideOf = (b: Box, p: P): "r" | "l" | "t" | "b" | null => {
    const e = 0.75;
    if (Math.abs(p.x - (b.x + b.w)) < e) return "r";
    if (Math.abs(p.x - b.x) < e) return "l";
    if (Math.abs(p.y - (b.y + b.h)) < e) return "b";
    if (Math.abs(p.y - b.y) < e) return "t";
    return null;
  };
  for (const [id, [s, t]] of geo.ends) {
    const e = geo.edges.get(id);
    if (!e || e.points.length < 2) continue;
    const sb = geo.nodes.get(s);
    const tb = geo.nodes.get(t);
    if (!sb || !tb) continue;
    const p0 = e.points[0];
    const p1 = e.points[1];
    const ss = sideOf(sb, p0);
    if (ss) refs.push({ edge: id, end: "s", node: s, side: ss, pos: p0, adj: p1, coord: ss === "r" || ss === "l" ? p0.y : p0.x });
    const pn = e.points[e.points.length - 1];
    const pp = e.points[e.points.length - 2];
    const st = sideOf(tb, pn);
    if (st) refs.push({ edge: id, end: "t", node: t, side: st, pos: pn, adj: pp, coord: st === "r" || st === "l" ? pn.y : pn.x });
  }
  const buckets = new Map<string, PortRef[]>();
  for (const r of refs) {
    const k = `${r.node}:${r.side}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  for (const [, list] of buckets) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.coord - b.coord || a.edge.localeCompare(b.edge) || (a.end < b.end ? -1 : 1));
    const b = geo.nodes.get(list[0].node)!;
    const horizontal = list[0].side === "r" || list[0].side === "l";
    const center = horizontal ? b.y + b.h / 2 : b.x + b.w / 2;
    const span = horizontal ? b.h : b.w;
    const gap = Math.min(20, Math.max(10, (span - 16) / list.length));
    const first = center - (gap * (list.length - 1)) / 2;
    list.forEach((r, i) => {
      const move = first + i * gap - r.coord;
      if (horizontal) {
        const old = r.pos.y;
        r.pos.y += move;
        if (Math.abs(r.adj.y - old) < 0.001) r.adj.y += move;
      } else {
        const old = r.pos.x;
        r.pos.x += move;
        if (Math.abs(r.adj.x - old) < 0.001) r.adj.x += move;
      }
    });
  }
  return geo;
}

export function layout<T extends IRLike>(ir: T, boxes?: FitBox[]): T {
  if (!ir.nodes.length) return ir;
  const g = spreadPorts(applyPins(ir, place(ir, boxes)));
  return {
    ...ir,
    nodes: ir.nodes.map((n) => {
      const b = g.nodes.get(n.id);
      return b ? { ...n, x: b.x, y: b.y, w: b.w, h: b.h } : n;
    }),
    groups: ir.groups.map((gr) => {
      const b = g.groups.get(gr.id);
      if (b) return { ...gr, x: b.x, y: b.y, w: b.w, h: b.h };
      const { x: _x, y: _y, w: _w, h: _h, ...rest } = gr as IGroup & Partial<Box>;
      return rest;
    }),
    edges: ir.edges.map((e) => {
      const r = g.edges.get(e.id);
      return r ? { ...e, points: r.points, labelPos: e.label ? labelAtPts(r.points) : undefined } : e;
    }),
    canvas: { width: g.width, height: g.height },
  } as T;
}
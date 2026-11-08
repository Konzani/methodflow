import dagre from "dagre";

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

const HEADER = 28;
const MARGIN = 24;
const CHAR = 6.9;
const LINE = 16;

const METRICS = {
  spacious: { vgap: 52, colGap: 76, pad: 22, groupGap: 36 },
  balanced: { vgap: 44, colGap: 68, pad: 20, groupGap: 30 },
  compact: { vgap: 34, colGap: 60, pad: 18, groupGap: 24 },
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
  return wrapLines(label ?? "", WRAP_AT[shape] ?? 24);
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

function compute(ir: IRLike): Geo {
  const M = METRICS[(ir.meta?.density as keyof typeof METRICS) ?? "balanced"] ?? METRICS.balanced;
  const nodes = ir.nodes;
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
  const gidOf = (n: INode) => (n.groupId && gdefs.has(n.groupId) ? n.groupId : NONE);
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
  for (const e of edges) {
    const G = gi.get(e.source)!;
    if (back.has(e.id)) {
      if (gi.get(e.target) === G) backIn[G].push(e);
      else backOut.push(e);
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

  const routeBack = (e: IEdge): P[] => {
    const s = nb(e.source); const t = nb(e.target);
    const global = gi.get(e.source) !== gi.get(e.target);
    const k = chIdx.get(e.id) ?? 0;
    const gx = global ? gOut(k) : gIn(k);
    const a = right(s);
    if (nodeById.get(e.target)!.shape === "decision") {
      const my = entryY(e.target);
      return [a, { x: gx, y: a.y }, { x: gx, y: my }, { x: t.cx, y: my }, top(t)];
    }
    const b = right(t);
    return [a, { x: gx, y: a.y }, { x: gx, y: b.y }, b];
  };

  const edgesOut = new Map<string, { points: P[]; label?: LabelPos }>();
  const ends = new Map<string, [string, string]>();
  for (const e of edges) {
    const pts = back.has(e.id) ? routeBack(e) : routeFwd(e);
    edgesOut.set(e.id, { points: pts, label: e.label ? labelAtPts(pts) : undefined });
    ends.set(e.id, [e.source, e.target]);
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
  const [a, b] = pts;
  if (a.x === b.x) return { x: a.x + 8, y: a.y + (b.y >= a.y ? 15 : -6), anchor: "start" };
  return { x: a.x + (b.x >= a.x ? 8 : -8), y: a.y - 7, anchor: b.x >= a.x ? "start" : "end" };
}

function tidy(pts: P[]): P[] {
  const out: P[] = [];
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
  const used = new Set(ir.nodes.map((n) => n.groupId).filter(Boolean) as string[]);
  const gids = new Set(ir.groups.filter((x) => used.has(x.id)).map((x) => x.id));
  gids.forEach((id) => g.setNode("g:" + id, {}));
  for (const n of ir.nodes) {
    const s = size.get(n.id)!;
    g.setNode(n.id, { width: s.w, height: s.h });
    if (n.groupId && gids.has(n.groupId)) g.setParent(n.id, "g:" + n.groupId);
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
    const ms = ir.nodes.filter((n) => n.groupId === id);
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

const fitScale = (g: Geo) => Math.min(1, 642 / g.width, 971 / g.height);

function place(ir: IRLike): Geo {
  const dir = ir.meta?.flowDirection ?? "auto";
  const lr = () => {
    try { return placeLR(ir); } catch { return null; }
  };
  if (dir === "lr") return lr() ?? compute(ir);
  const tb = compute(ir);
  if (dir !== "auto" || ir.nodes.length < 8 || fitScale(tb) >= 0.85) return tb;
  const alt = lr();
  return alt && fitScale(alt) > fitScale(tb) * 1.2 ? alt : tb;
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
  return fitCanvas({ ...geo, nodes, edges, groups });
}

export function layout<T extends IRLike>(ir: T): T {
  if (!ir.nodes.length) return ir;
  const g = applyPins(ir, place(ir));
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
      return r ? { ...e, points: r.points, labelPos: r.label } : e;
    }),
    canvas: { width: g.width, height: g.height },
  } as T;
}
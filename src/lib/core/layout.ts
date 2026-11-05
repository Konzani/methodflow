import dagre from "dagre";

export type P = { x: number; y: number };
export type LabelPos = P & { anchor: "start" | "middle" | "end" };
type Box = { x: number; y: number; w: number; h: number };

type INode = { id: string; label: string; shape: string; groupId?: string };
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

function wrapLines(label: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of label.trim().split(/\s+/)) {
    if (cur && (cur + " " + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function sizeOf(n: INode, isLR: boolean): { w: number; h: number } {
  const label = n.label ?? "";
  let w = 190, h = 54;

  if (n.shape === "decision") {
    const lines = wrapLines(label, isLR ? 24 : 16);
    const textW = Math.max(...lines.map((l) => l.length)) * CHAR;
    const textH = lines.length * LINE;
    // Increased padding significantly to prevent text overflow
    h = Math.max(100, textH * 2 + 36); 
    const k = 1 - textH / h;
    // Ensure width is at least 220px and accounts for the text
    w = Math.max(220, Math.ceil((textW + 40) / k / 10) * 10);
  } else if (n.shape === "terminator") {
    const lines = wrapLines(label, isLR ? 30 : 26);
    const textW = Math.max(...lines.map((l) => l.length)) * CHAR;
    w = Math.max(170, Math.ceil(textW + 48));
    h = Math.max(46, lines.length * LINE + 24);
  } else {
    const lines = wrapLines(label, isLR ? 30 : 24);
    const extra = n.shape === "document" ? 8 : n.shape === "database" ? 12 : 0;
    w = isLR ? Math.max(220, Math.max(...lines.map((l) => l.length)) * CHAR + 40) : 190;
    h = Math.max(54, lines.length * LINE + 22) + extra;
  }
  
  return isLR ? { w: h, h: w } : { w, h };
}

const NEG = /^(no|fail\w*|exclu\w*|reject\w*|den\w*|not\b|inelig\w*|below|unmet|invalid|retry|insufficient)/i;
const NONE = "__none";

function compute(ir: IRLike): Geo {
  const M = METRICS[(ir.meta?.density as keyof typeof METRICS) ?? "balanced"] ?? METRICS.balanced;
  const isLR = ir.meta?.flowDirection === "lr";
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

  const size = new Map(nodes.map((n) => [n.id, sizeOf(n, isLR)]));
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

  const labelAt = (pts: P[]): LabelPos => {
    const [a, b] = pts;
    if (a.x === b.x) return { x: a.x + 8, y: a.y + (b.y >= a.y ? 15 : -6), anchor: "start" };
    return { x: a.x + (b.x >= a.x ? 8 : -8), y: a.y - 7, anchor: b.x >= a.x ? "start" : "end" };
  };

  const edgesOut = new Map<string, { points: P[]; label?: LabelPos }>();
  const ends = new Map<string, [string, string]>();
  for (const e of edges) {
    let pts = back.has(e.id) ? routeBack(e) : routeFwd(e);
    if (isLR) pts = pts.map(p => ({ x: p.y, y: p.x }));
    edgesOut.set(e.id, { points: pts, label: e.label ? labelAt(pts) : undefined });
    ends.set(e.id, [e.source, e.target]);
  }

  const dx = MARGIN - boxL; const dy = MARGIN;
  const mv = (b: Box): Box => ({ ...b, x: b.x + dx, y: b.y + dy });
  const mp = (p: P): P => ({ x: p.x + dx, y: p.y + dy });

  const finalNodes = new Map([...nodeBox].map(([k, b]) => {
    const box = mv(b);
    return [k, isLR ? { ...box, w: box.h, h: box.w } : box];
  }));
  const finalGroups = new Map([...groupBox].map(([k, b]) => {
    const box = mv(b);
    return [k, isLR ? { ...box, w: box.h, h: box.w } : box];
  }));

  return {
    nodes: finalNodes,
    groups: finalGroups,
    nodeGroup,
    edges: new Map([...edgesOut].map(([k, v]) => [k, { points: v.points.map(mp), label: v.label ? { ...v.label, ...mp(v.label) } : undefined }])),
    ends,
    width: isLR ? totalH + 2 * MARGIN : canvasR - boxL + 2 * MARGIN,
    height: isLR ? canvasR - boxL + 2 * MARGIN : totalH + 2 * MARGIN,
  };
}

export function layout<T extends IRLike>(ir: T): T {
  if (!ir.nodes.length) return ir;

  // If the user requested Left-to-Right, use the standard Dagre engine
  if (ir.meta?.flowDirection === "lr") {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 80, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));

    ir.nodes.forEach((n) => {
      // Approximate sizes for LR
      const w = n.label.length * 7.5 + 30;
      const h = 60;
      g.setNode(n.id, { width: w, height: h });
    });

    ir.edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return {
      ...ir,
      nodes: ir.nodes.map((n) => {
        const p = g.node(n.id);
        const w = n.label.length * 7.5 + 30;
        return { ...n, x: p.x - w / 2, y: p.y - 30, w, h: 60 } as any;
      }),
      groups: [], // Hide bands for LR mode to prevent layout breaking
      canvas: { width: g.graph().width! + 80, height: g.graph().height! + 80 },
    } as any;
  }

  // Otherwise, use your custom deterministic Top-to-Bottom engine
  const g = compute(ir);
  return {
    ...ir,
    nodes: ir.nodes.map((n) => {
      const b = g.nodes.get(n.id);
      return b ? { ...n, x: b.x, y: b.y, w: b.w, h: b.h } : n;
    }),
    groups: ir.groups.map((gr) => {
      const b = g.groups.get(gr.id);
      return b ? { ...gr, x: b.x, y: b.y, w: b.w, h: b.h } : gr;
    }),
    edges: ir.edges.map((e) => {
      const r = g.edges.get(e.id);
      return r ? { ...e, points: r.points, labelPos: r.label } : e;
    }),
    canvas: { width: g.width, height: g.height },
  } as T;
}
import dagre from "dagre";
import type { IR, Shape, Density, FlowDirection } from "./ir";

export const size = (s: Shape) =>
  s === "decision" ? { w: 220, h: 110 }
  : s === "terminator" ? { w: 180, h: 56 }
  : s === "database" ? { w: 210, h: 86 }
  : { w: 220, h: 70 };

const SPACING: Record<Density, { ns: number; rs: number; pad: number }> = {
  compact: { ns: 40, rs: 50, pad: 24 },
  balanced: { ns: 70, rs: 80, pad: 40 },
  spacious: { ns: 110, rs: 130, pad: 64 },
};

function runDagre(ir: IR, rankdir: "TB" | "LR", d: Density, customNs?: number, customRs?: number): IR {
  const g = new dagre.graphlib.Graph();
  const { ns, rs, pad } = SPACING[d];
  g.setGraph({ 
    rankdir, 
    nodesep: customNs ?? ns, 
    ranksep: customRs ?? rs, 
    marginx: pad, 
    marginy: pad 
  });
  g.setDefaultEdgeLabel(() => ({}));
  ir.nodes.forEach((n) => {
    const z = size(n.shape);
    g.setNode(n.id, { width: z.w, height: z.h });
  });
  ir.edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    ...ir,
    nodes: ir.nodes.map((n) => {
      const p = g.node(n.id);
      const z = size(n.shape);
      return { ...n, x: Math.round(p.x - z.w / 2), y: Math.round(p.y - z.h / 2) };
    }),
  };
}

function bounds(ir: IR) {
  let mx = 0, my = 0;
  for (const n of ir.nodes) {
    const z = size(n.shape);
    mx = Math.max(mx, (n.x ?? 0) + z.w);
    my = Math.max(my, (n.y ?? 0) + z.h);
  }
  return { w: mx, h: my };
}

export function layout(ir: IR): IR {
  const d: Density = ir.meta.density ?? "balanced";
  const dir: FlowDirection = ir.meta.flowDirection ?? "auto";

  if (dir === "tb") return runDagre(ir, "TB", d);
  if (dir === "lr") return runDagre(ir, "LR", d);

  const tb = runDagre(ir, "TB", d);
  const b = bounds(tb);
  const ratio = b.h / Math.max(b.w, 1);
  if (ratio <= 3.5) return tb;
  return runDagre(ir, "LR", d);
}

/**
 * Attempts to arrange the diagram to perfectly fill the page.
 * It stretches the nodesep and ranksep to match the page aspect ratio.
 */
export function fitToPage(ir: IR, pageW: number, pageH: number, margin: number): IR {
  const d = ir.meta.density ?? "balanced";
  const dir = pageW > pageH ? "LR" : "TB";
  
  // 1. Run initial layout to measure
  const tmp = runDagre(ir, dir, d);
  const b = bounds(tmp);
  
  // 2. Calculate available page space
  const availW = pageW - (margin * 3.7795 * 2); 
  const availH = pageH - (margin * 3.7795 * 2);

  const scaleX = availW / b.w;
  const scaleY = availH / b.h;
  
  // 3. Stretch spacing dynamically to fill the available space
  const { ns, rs } = SPACING[d];
  const newNs = ns * (dir === "LR" ? scaleY : scaleX);
  const newRs = rs * (dir === "LR" ? scaleX : scaleY);

  // 4. Re-run with the new optimal spacing
  return {
    ...runDagre(ir, dir, d, Math.max(newNs, 30), Math.max(newRs, 40)),
    meta: { ...ir.meta, flowDirection: dir }
  };
}

export const placed = (ir: IR) =>
  ir.nodes.every((n) => typeof n.x === "number" && typeof n.y === "number")
    ? ir
    : layout(ir);
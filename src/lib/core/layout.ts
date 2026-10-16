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

function runDagre(ir: IR, rankdir: "TB" | "LR", d: Density): IR {
  const g = new dagre.graphlib.Graph();
  const { ns, rs, pad } = SPACING[d];
  g.setGraph({ rankdir, nodesep: ns, ranksep: rs, marginx: pad, marginy: pad });
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

/**
 * Layout with automatic flow direction.
 * - "tb": top-to-bottom
 * - "lr": left-to-right
 * - "auto": run both, prefer TB unless it becomes too tall (ratio > 3.5)
 *
 * A ratio above 3.5 means the diagram is more than 3.5× taller than wide,
 * which scales poorly onto a standard page in portrait and produces tiny
 * text. In that case we flip to left-to-right, which yields a wide, short
 * diagram suited to landscape orientation (or a scrollable wide view).
 */
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

export const placed = (ir: IR) =>
  ir.nodes.every((n) => typeof n.x === "number" && typeof n.y === "number")
    ? ir
    : layout(ir);
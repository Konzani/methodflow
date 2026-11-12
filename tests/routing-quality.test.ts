import { describe, expect, it } from "vitest";
import { layout } from "@/lib/core/layout";
import { floodIR, floodWithDirection } from "./fixtures/flood";

type P = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Box = Rect;
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const box = (o: any): Rect | null => (finite(o?.x) && finite(o?.y) && finite(o?.w) && finite(o?.h) ? o : null);
const inside = (p: P, r: Rect) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
const segRect = (a: P, b: P, r: Rect) =>
  Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.w && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.h;
const segs = (pts: P[]): [P, P][] => {
  const out: [P, P][] = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  return out;
};
const cross = (a: P, b: P, c: P, d: P) => {
  const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
};

function audit(ir: any) {
  const o: any = layout(ir);
  const nodeBox = new Map<string, Rect>();
  const groupOf = new Map<string, string>();
  for (const n of o.nodes) {
    const b = box(n);
    if (b) nodeBox.set(n.id, b);
    if (n.groupId) groupOf.set(n.id, n.groupId);
  }
  const groupBox = new Map<string, Rect>();
  for (const g of o.groups) {
    const b = box(g);
    if (b) groupBox.set(g.id, b);
  }

  let nodeCross = 0, groupCross = 0, badPts = 0, nonOrtho = 0;
  const portCounts = new Map<string, number>();
  const routed: { id: string; pts: P[]; source: string; target: string }[] = [];

  for (const e of o.edges) {
    const pts: P[] = e.points ?? [];
    if (pts.length < 2 || pts.some((p: P) => !finite(p.x) || !finite(p.y))) { badPts++; continue; }
    const sg = groupOf.get(e.source), tg = groupOf.get(e.target);
    for (const [gid, r] of groupBox) {
      if (gid === sg || gid === tg) continue;
      if (segs(pts).some(([a, b]) => segRect(a, b, r))) { groupCross++; break; }
    }
    for (const [id, r] of nodeBox) {
      if (id === e.source || id === e.target) continue;
      if (segs(pts).some(([a, b]) => segRect(a, b, r))) { nodeCross++; break; }
    }
    for (const [a, b] of segs(pts)) if (a.x !== b.x && a.y !== b.y) nonOrtho++;
    for (const p of [pts[0], pts[pts.length - 1]]) {
      const k = `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
      portCounts.set(k, (portCounts.get(k) ?? 0) + 1);
    }
    routed.push({ id: e.id, pts, source: e.source, target: e.target });
  }

  let edgeCross = 0;
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const A = routed[i], B = routed[j];
      if (new Set([A.source, A.target, B.source, B.target]).size < 4) continue;
      if (segs(A.pts).some(([a, b]) => segs(B.pts).some(([c, d]) => cross(a, b, c, d)))) edgeCross++;
    }
  }

  for (const g of o.groups) {
    const b = box(g);
    expect(b).not.toBeNull();
    if (!b) continue;
    expect(o.nodes.some((n: any) => n.groupId === g.id && box(n) && inside({ x: n.x + n.w / 2, y: n.y + n.h / 2 }, b))).toBe(true);
  }
  return {
    o,
    nodeCross,
    groupCross,
    edgeCross,
    nonOrtho,
    badPts,
    sharedPorts: [...portCounts.values()].reduce((a, c) => a + Math.max(0, c - 1), 0),
  };
}

describe("routing quality on the Nzoia flood-hazard workflow", () => {
  for (const dir of ["auto", "tb", "lr"] as const) {
    it(`${dir}: clean arrows — no phase-box or node crossings, distinct ports, minimal edge crossings`, () => {
      const r = audit(floodWithDirection(dir));
      expect(r.badPts).toBe(0);
      expect(r.nonOrtho).toBe(0);
      expect(r.groupCross).toBe(0);
      expect(r.nodeCross).toBe(0);
      expect(r.sharedPorts).toBe(0);
      expect(r.edgeCross).toBeLessThanOrEqual(6);
      expect(r.o.groups.length).toBe(5);
      expect(r.o.edges.length).toBe(floodIR.edges.length);
    });
  }

  it("is deterministic: repeat layout produces identical geometry", () => {
    const a: any = audit(floodWithDirection("auto")).o;
    const b: any = audit(floodWithDirection("auto")).o;
    expect(a.canvas).toEqual(b.canvas);
    expect(a.nodes.map((n: any) => [n.id, n.x, n.y, n.w, n.h])).toEqual(b.nodes.map((n: any) => [n.id, n.x, n.y, n.w, n.h]));
    expect(a.edges.map((e: any) => [e.id, e.points])).toEqual(b.edges.map((e: any) => [e.id, e.points]));
  });

  it("preserves the three-branch fork and merge structure", () => {
    const o: any = layout(floodWithDirection("auto"));
    const out = (id: string) => o.edges.filter((e: any) => e.source === id).map((e: any) => e.target).sort();
    expect(out("n2")).toEqual(["n12", "n3", "n9"]);
    expect(o.edges.filter((e: any) => e.target === "n16").length).toBe(5);
    expect(o.edges.filter((e: any) => e.target === "n17").map((e: any) => e.source).sort()).toEqual(["n16", "n20"]);
  });
});

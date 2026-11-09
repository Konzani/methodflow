import { describe, expect, it } from "vitest";
import { layout } from "@/lib/core/layout";

const G: [string, string][] = [["g1", "Study area and data"], ["g2", "Data preprocessing"], ["g3", "MaxEnt modelling"], ["g4", "GWR modelling"], ["g5", "Integration and validation"]];
const L: [string, string, number][] = [
  ["Define 1,200 km² Keiyo South study area", "terminator", 1], ["Compile historical landslide inventory", "process", 1], ["Extract landslide centroid points", "process", 1], ["Acquire DEM, CHIRPS, KENSOTER, Landsat and proximity layers", "process", 1],
  ["Resample rasters to 5 m and standardize CRS", "process", 2], ["Assess predictor multicollinearity", "process", 2], ["Partition inventory into training and testing sets", "process", 2],
  ["Run MaxEnt with tuned regularization multiplier", "process", 3], ["Generate response curves and Jackknife variable tests", "process", 3], ["Produce normalized MaxEnt probability raster", "process", 3], ["Validate MaxEnt with AUC-ROC", "process", 3],
  ["Build binary presence-absence dataset with localized predictors", "process", 4], ["Fit GWR with Gaussian kernel and AICc-optimized bandwidth", "process", 4], ["Generate local coefficients, local R² and residual maps", "process", 4],
  ["Min-max normalize MaxEnt and GWR outputs", "process", 5], ["Calculate AUC-based model weights", "process", 5], ["Weighted spatial overlay to hybrid model", "process", 5], ["Validate hybrid model on independent test data", "process", 5],
  ["Performance acceptable?", "decision", 5], ["Reassess model inputs and weighting", "process", 5], ["Classify susceptibility into five risk classes", "process", 5], ["Report susceptibility zones for land-use planning", "terminator", 5],
];
const ed: [number, number, string?][] = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 12], [8, 9], [9, 10], [10, 11], [12, 13], [13, 14], [11, 15], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 21, "Yes"], [19, 20, "No"], [20, 17], [21, 22]];
const ir = (dir: string): any => ({
  meta: { title: "t", methodology: "custom", flowDirection: dir },
  groups: G.map(([id, label]) => ({ id, label })),
  nodes: L.map(([label, shape, g], i) => ({ id: "n" + (i + 1), label, shape, groupId: "g" + g })),
  edges: ed.map(([a, b, label], i) => ({ id: "e" + (i + 1), source: "n" + a, target: "n" + b, label })),
});
const scale = (o: any) => Math.min(1, 642 / o.canvas.width, 971 / o.canvas.height);
const hits = (o: any) => {
  let c = 0;
  for (const e of o.edges) {
    const p = e.points;
    for (let i = 1; i < p.length; i++) {
      for (const n of o.nodes) {
        if (n.id === e.source || n.id === e.target) continue;
        if (Math.max(p[i - 1].x, p[i].x) > n.x && Math.min(p[i - 1].x, p[i].x) < n.x + n.w && Math.max(p[i - 1].y, p[i].y) > n.y && Math.min(p[i - 1].y, p[i].y) < n.y + n.h) { c++; break; }
      }
    }
  }
  return c;
};

describe("page-aware auto layout", () => {
  it("folds a tall multi-phase flow into columns and prints larger", () => {
    const tb = layout(ir("tb"));
    const auto = layout(ir("auto"));
    console.log("tb", Math.round(tb.canvas!.width), Math.round(tb.canvas!.height), scale(tb).toFixed(2), "auto", Math.round(auto.canvas!.width), Math.round(auto.canvas!.height), scale(auto).toFixed(2));
    expect(scale(auto)).toBeGreaterThan(scale(tb) * 1.15);
    expect(auto.groups.length).toBe(5);
    expect(hits(auto)).toBe(0);
    for (const e of auto.edges as any[]) for (let i = 1; i < e.points.length; i++) expect(e.points[i].x === e.points[i - 1].x || e.points[i].y === e.points[i - 1].y).toBe(true);
    for (let i = 0; i < auto.nodes.length; i++) for (let j = i + 1; j < auto.nodes.length; j++) {
      const a: any = auto.nodes[i], b: any = auto.nodes[j];
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
    }
  });
  it("explicit top-to-bottom stays a single column", () => {
    const tb: any = layout(ir("tb"));
    expect(new Set(tb.groups.map((g: any) => Math.round(g.x))).size).toBe(1);
  });
});

import { printInfo } from "@/lib/export/print";
describe("print info", () => {
  it("reports a larger print size for the folded layout than for a single column", () => {
    const tb = printInfo(layout(ir("tb")) as any);
    const auto = printInfo(layout(ir("auto")) as any);
    expect(auto.pt).toBeGreaterThan(tb.pt);
    expect(tb.level).toBe("small");
  });
});

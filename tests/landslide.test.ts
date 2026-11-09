import { describe, expect, it } from "vitest";
import { layout, pageScore, compute, foldGeo } from "@/lib/core/layout";

const grp = [["g1", "Study area and inventory"], ["g2", "Predictor preparation"], ["g3", "MaxEnt modelling"], ["g4", "GWR modelling"], ["g5", "Integration and reporting"]];
const N: [string, string, number][] = [["Define 1,200 km² Keiyo South study area", "terminator", 1], ["Compile historical landslide inventory", "process", 1], ["Extract landslide centroid points", "process", 1],
  ["Derive slope, aspect and elevation from DEM", "process", 2], ["Prepare CHIRPS rainfall and KENSOTER layers", "process", 2], ["Derive Landsat LULC and river/road proximity", "process", 2], ["Resample to 5 m and standardize CRS", "process", 2], ["Multicollinearity acceptable?", "decision", 2], ["Revise predictor set", "process", 2], ["Prepare modelling datasets", "process", 2],
  ["Partition inventory into training and testing", "process", 3], ["Run MaxEnt with presence-only data", "process", 3], ["Tune regularization multiplier", "process", 3], ["Generate response curves and Jackknife tests", "process", 3], ["Validate MaxEnt using AUC-ROC", "process", 3], ["Export normalized 0–1 probability raster", "process", 3],
  ["Digitize binary presence–absence dataset", "process", 4], ["Pair data with localized predictor rasters", "process", 4], ["Optimize AICc bandwidth with Gaussian kernel", "process", 4], ["Fit WLS, map local diagnostics", "process", 4],
  ["Min-max normalize MaxEnt and GWR outputs", "process", 5], ["Compute AUC-based model weights", "process", 5], ["Weighted spatial overlay in GIS", "process", 5], ["Validate hybrid model with independent test data", "process", 5], ["Classify five susceptibility classes", "process", 5], ["Deliver susceptibility map and model report", "terminator", 5]];
const E: [number, number, string?][] = [[1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7], [7, 8], [8, 10, "Yes"], [8, 9, "No"], [9, 7], [10, 11], [10, 17], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 21], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26]];
const mk = (dir: string): any => ({
  meta: { title: "Landslide susceptibility workflow", methodology: "custom", caption: "Workflow of the hybrid model.", flowDirection: dir },
  groups: grp.map(([id, label]) => ({ id, label })),
  nodes: N.map(([label, shape, g], i) => ({ id: "n" + (i + 1), label, shape, groupId: "g" + g })),
  edges: E.map(([a, b, label], i) => ({ id: "e" + (i + 1), source: "n" + a, target: "n" + b, label })),
});
const hits = (o: any) => {
  const out: string[] = [];
  for (const e of o.edges) {
    const p = e.points;
    for (let i = 1; i < p.length; i++)
      for (const n of o.nodes) {
        if (n.id === e.source || n.id === e.target) continue;
        if (Math.max(p[i - 1].x, p[i].x) > n.x && Math.min(p[i - 1].x, p[i].x) < n.x + n.w && Math.max(p[i - 1].y, p[i].y) > n.y && Math.min(p[i - 1].y, p[i].y) < n.y + n.h) out.push(`${e.source}>${e.target} through ${n.id}`);
      }
  }
  return out;
};

describe("landslide workflow (real user output)", () => {
  for (const d of ["tb", "auto", "lr"]) {
    it(`${d}: no edge crosses a node, all segments orthogonal, groups intact`, () => {
      const o: any = layout(mk(d));
      console.log("LS", d, Math.round(o.canvas.width), Math.round(o.canvas.height), pageScore(o.canvas.width, o.canvas.height).toFixed(2), hits(o).join(";"));
      expect(hits(o)).toEqual([]);
      expect(o.groups.length).toBe(5);
      for (const e of o.edges) for (let i = 1; i < e.points.length; i++) expect(e.points[i].x === e.points[i - 1].x || e.points[i].y === e.points[i - 1].y).toBe(true);
    });
  }
  it("auto prints clearly larger than a single column", () => {
    const tb: any = layout(mk("tb"));
    const auto: any = layout(mk("auto"));
    expect(pageScore(auto.canvas.width, auto.canvas.height)).toBeGreaterThan(pageScore(tb.canvas.width, tb.canvas.height) * 1.3);
  });
});

it("dbgfold", () => {
  const ir = mk("auto");
  const tb = compute(ir);
  console.log("TBW", Math.round(tb.width), Math.round(tb.height));
  for (let k = 2; k <= 5; k++) { const g = foldGeo(ir, tb, k); console.log("K", k, g ? Math.round(g.width) + "x" + Math.round(g.height) + " " + pageScore(g.width, g.height).toFixed(2) : "null"); }
});
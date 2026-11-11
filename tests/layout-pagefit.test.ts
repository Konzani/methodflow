import { describe, expect, it } from "vitest";
import { layout, pageScore } from "@/lib/core/layout";
import { migrate } from "@/lib/core/migrate";
import { TEMPLATES } from "@/lib/templates";
import type { IR } from "@/lib/core/ir";

type Box = { x: number; y: number; w: number; h: number };
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const box = (o: any): Box | null => (finite(o?.x) && finite(o?.y) && finite(o?.w) && finite(o?.h) ? o : null);
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (b: Box, g: Box) => b.x + b.w / 2 > g.x && b.x + b.w / 2 < g.x + g.w && b.y + b.h / 2 > g.y && b.y + b.h / 2 < g.y + g.h;

function crossings(o: any): number {
  let c = 0;
  for (const e of o.edges) {
    const p = e.points ?? [];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      for (const n of o.nodes) {
        if (n.id === e.source || n.id === e.target) continue;
        if (Math.max(a.x, b.x) > n.x && Math.min(a.x, b.x) < n.x + n.w && Math.max(a.y, b.y) > n.y && Math.min(a.y, b.y) < n.y + n.h) {
          c++;
          break;
        }
      }
    }
  }
  return c;
}

function notOrthogonal(o: any): number {
  let c = 0;
  for (const e of o.edges) {
    const p = e.points ?? [];
    for (let i = 1; i < p.length; i++) if (p[i].x !== p[i - 1].x && p[i].y !== p[i - 1].y) c++;
  }
  return c;
}

// 17 nodes, 5 phases, two parallel strands, two decision gates, two revision loops.
function mixedWorkflow(ungrouped = false): any {
  const nodes: [string, string, number | null][] = [
    ["Define research problem", "terminator", 1], ["Select convergent mixed-methods design", "process", 1], ["Submit ethics application", "process", 1], ["Ethics approval granted?", "decision", 1], ["Revise ethics application", "process", 1], ["Start parallel data collection", "process", 1],
    ["Administer structured questionnaire", "process", 2], ["Fit regression models", "process", 2], ["Check model assumptions", "process", 2],
    ["Conduct semi-structured interviews", "process", 3], ["Transcribe interviews", "process", 3], ["Thematic saturation reached?", "decision", 3], ["Recruit further participants", "process", 3], ["Code transcripts thematically", "process", 3],
    ["Compare quantitative and qualitative findings", "process", 4], ["Interpret integrated results", "process", 4],
    ["Report findings", "terminator", 5]];
  const edges: [number, number, string?][] = [
    [1, 2], [2, 3], [3, 4], [4, 6, "Yes"], [4, 5, "No"], [5, 3], [6, 7], [6, 9], [7, 8], [8, 15],
    [9, 10], [10, 11], [11, 12], [12, 14, "Yes"], [12, 13, "No"], [13, 10], [14, 15], [15, 16], [16, 17]];
  if (ungrouped) nodes[3][2] = null; // a node the model forgot to group
  return {
    meta: { title: "Convergent mixed-methods study design", methodology: "mixed", caption: "Workflow.", flowDirection: "auto" },
    groups: [["g1", "Design and approvals"], ["g2", "Quantitative strand"], ["g3", "Qualitative strand"], ["g4", "Integration"], ["g5", "Reporting"]].map(([id, label]) => ({ id, label })),
    nodes: nodes.map(([label, shape, g], i) => ({ id: "n" + (i + 1), label, shape, groupId: g ? "g" + g : undefined })),
    edges: edges.map(([a, b, label], i) => ({ id: "e" + (i + 1), source: "n" + a, target: "n" + b, label })),
  };
}

// 26 nodes, 5 sequential phases, bracketed decisions and a cross-phase back edge.
function longReview(): any {
  const nodes: [string, string, number][] = [
    ["Define 1,200 km² Keiyo South study area", "terminator", 1], ["Compile historical landslide inventory", "process", 1], ["Extract landslide centroid points", "process", 1],
    ["Derive slope, aspect and elevation from DEM", "process", 2], ["Prepare CHIRPS rainfall and KENSOTER layers", "process", 2], ["Derive Landsat LULC and river/road proximity", "process", 2], ["Resample to 5 m and standardize CRS", "process", 2], ["Multicollinearity acceptable?", "decision", 2], ["Revise predictor set", "process", 2], ["Prepare modelling datasets", "process", 2],
    ["Partition inventory into training and testing", "process", 3], ["Run MaxEnt with presence-only data", "process", 3], ["Tune regularization multiplier", "process", 3], ["Generate response curves and Jackknife tests", "process", 3], ["Validate MaxEnt using AUC-ROC", "process", 3], ["Export normalized 0–1 probability raster", "process", 3],
    ["Digitize binary presence–absence dataset", "process", 4], ["Pair data with localized predictor rasters", "process", 4], ["Optimize AICc bandwidth with Gaussian kernel", "process", 4], ["Fit WLS, map local diagnostics", "process", 4],
    ["Min-max normalize MaxEnt and GWR outputs", "process", 5], ["Compute AUC-based model weights", "process", 5], ["Weighted spatial overlay in GIS", "process", 5], ["Validate hybrid model with independent test data", "process", 5], ["Classify five susceptibility classes", "process", 5], ["Deliver susceptibility map and model report", "terminator", 5]];
  const edges: [number, number, string?][] = [[1, 2], [2, 3], [3, 4], [3, 5], [3, 6], [4, 7], [5, 7], [6, 7], [7, 8], [8, 10, "Yes"], [8, 9, "No"], [9, 7], [10, 11], [10, 17], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16], [16, 21], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25], [25, 26]];
  return {
    meta: { title: "Landslide susceptibility workflow", methodology: "custom", caption: "Workflow.", flowDirection: "tb" },
    groups: [["g1", "Study area and inventory"], ["g2", "Predictor preparation"], ["g3", "MaxEnt modelling"], ["g4", "GWR modelling"], ["g5", "Integration and reporting"]].map(([id, label]) => ({ id, label })),
    nodes: nodes.map(([label, shape, g], i) => ({ id: "n" + (i + 1), label, shape, groupId: "g" + g })),
    edges: edges.map(([a, b, label], i) => ({ id: "e" + (i + 1), source: "n" + a, target: "n" + b, label })),
  };
}

function check(o: any) {
  expect(o.nodes.every((n: any) => [n.x, n.y, n.w, n.h].every(Number.isFinite))).toBe(true);
  expect(o.groups.every((g: any) => [g.x, g.y, g.w, g.h].every(Number.isFinite))).toBe(true);
  expect(o.edges.every((e: any) => (e.points?.length ?? 0) >= 2)).toBe(true);
  expect(crossings(o)).toBe(0);
  expect(notOrthogonal(o)).toBe(0);
  const boxes = o.groups.map(box) as Box[];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
  for (const n of o.nodes) if (n.groupId && box(n)) {
    const g = o.groups.find((x: any) => x.id === n.groupId);
    if (g && box(g)) expect(inside(n, g)).toBe(true);
  }
}

describe("page-aware layout", () => {
  it("folds tall exclusive TB regardless of ungrouped nodes", () => {
    for (const ir of [mixedWorkflow(), mixedWorkflow(true)]) {
      const auto: any = layout({ ...ir, meta: { ...ir.meta, flowDirection: "auto" } });
      const single: any = layout({ ...ir, meta: { ...ir.meta, flowDirection: "tb" } });
      expect(pageScore(auto.canvas.width, auto.canvas.height)).toBeGreaterThan(pageScore(single.canvas.width, single.canvas.height) * 1.1);
      check(auto);
      expect(auto.groups.length).toBe(5);
    }
  });

  it("wraps wide LR flows into page-width rows instead of one 4000px strip", () => {
    for (const ir of [longReview(), mixedWorkflow()]) {
      const lr: any = layout({ ...ir, meta: { ...ir.meta, flowDirection: "lr" } });
      check(lr);
      expect(pageScore(lr.canvas.width, lr.canvas.height)).toBeGreaterThan(0.4);
      expect(lr.canvas.width).toBeLessThan(2600);
      expect(lr.canvas.height).toBeGreaterThan(300);
    }
  });

  it("is reversible: tb -> lr -> tb -> auto -> tb keeps phases and geometry", () => {
    let ir: any = longReview();
    const shapes: string[] = [];
    for (const dir of ["tb", "lr", "tb", "auto", "tb"]) {
      ir = layout({ ...ir, meta: { ...ir.meta, flowDirection: dir }, nodes: ir.nodes.map((n: any) => ({ ...n, pinned: undefined })) });
      check(ir);
      expect(ir.groups.length).toBe(5);
      shapes.push(`${Math.round(ir.canvas.width)}x${Math.round(ir.canvas.height)}`);
    }
    expect(shapes[0]).toBe(shapes[2]);
    expect(shapes[2]).toBe(shapes[4]);
  });

  it("routes long back edges around nodes", () => {
    const ir: any = mixedWorkflow();
    ir.edges.push({ id: "e99", source: "n9", target: "n2" });
    const o: any = layout(ir);
    check(o);
  });

  it("keeps the explicit top-to-bottom option as a single column", () => {
    const tb: any = layout({ ...longReview(), meta: { ...longReview().meta, flowDirection: "tb" } });
    expect(new Set(tb.groups.map((g: any) => Math.round(g.x))).size).toBe(1);
  });
});

describe("layout defaults", () => {
  it("migrates v1.0 documents to page-aware defaults", () => {
    const v10: any = { ...mixedWorkflow(), version: "1.0" };
    delete (v10.meta as any).density;
    delete (v10.meta as any).flowDirection;
    delete (v10.meta as any).paletteId;
    const out = migrate(v10) as IR;
    expect(out.version).toBe("1.1");
    expect(out.meta.flowDirection).toBe("auto");
    expect(out.meta.density).toBe("balanced");
  });

  it("keeps explicit user choices on migration", () => {
    const v10: any = { ...mixedWorkflow(), version: "1.0" };
    v10.meta = { ...v10.meta, density: "spacious", flowDirection: "lr", paletteId: "tint" };
    const out = migrate(v10) as IR;
    expect(out.meta.flowDirection).toBe("lr");
    expect(out.meta.density).toBe("spacious");
    expect(out.meta.paletteId).toBe("tint");
  });

  it("ships every template as v1.1 with explicit page-aware style", () => {
    for (const t of TEMPLATES) {
      expect(t.ir.version).toBe("1.1");
      expect(t.ir.meta.flowDirection).toBe("auto");
      expect(t.ir.meta.density).toBe("balanced");
      expect(t.ir.meta.paletteId).toBe("mono");
    }
  });
});

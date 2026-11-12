import { describe, expect, it } from "vitest";
import { computeFit, contentBoxes, DEFAULT_PAGE, type PageSettings } from "@/lib/export/page";
import { layout } from "@/lib/core/layout";
import { bestPrintPlan, printInfo, printPt, printThresholds } from "@/lib/export/print";
import { floodIR } from "./fixtures/flood";

const smallIR: any = {
  version: "1.1",
  meta: { title: "Small workflow", methodology: "custom", flowDirection: "auto", density: "balanced" },
  groups: [{ id: "g1", label: "Phase one" }, { id: "g2", label: "Phase two" }],
  nodes: [
    { id: "n1", label: "Define objective", shape: "terminator", groupId: "g1" },
    { id: "n2", label: "Collect data", shape: "process", groupId: "g1" },
    { id: "n3", label: "Analyse", shape: "process", groupId: "g2" },
    { id: "n4", label: "Report findings", shape: "terminator", groupId: "g2" },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2" },
    { id: "e2", source: "n2", target: "n3" },
    { id: "e3", source: "n3", target: "n4" },
  ],
};

const a5: PageSettings = { ...DEFAULT_PAGE, size: "a5" };
const a4: PageSettings = { ...DEFAULT_PAGE };

describe("thesis-ready print sizing", () => {
  it("reports the real printed size; A5 is far smaller than A4/A3", () => {
    const p5 = printPt(floodIR, a5);
    const p4 = printPt(floodIR, a4);
    const p3 = printPt(floodIR, { ...DEFAULT_PAGE, size: "a3" });
    expect(p5).toBeLessThan(4);
    expect(p4).toBeGreaterThan(p5);
    expect(p3).toBeGreaterThan(p4);
    expect(printInfo(floodIR, a5).level).toBe("small");
  });

  it("promotes a dense A5 export to the smallest page that reaches 7 pt", () => {
    const plan = bestPrintPlan(floodIR, a5);
    expect(plan.basePt).toBeLessThan(4);
    expect(plan.pt).toBeGreaterThanOrEqual(7);
    expect(plan.promoted).toBe(true);
    expect(plan.page.size).toBe("a3");
    expect(plan.reason).toMatch(/A5/);
    expect(plan.reason).toMatch(/pt/);
  });

  it("keeps the user's page when it is already thesis-readable", () => {
    const plan = bestPrintPlan(smallIR, a4);
    expect(plan.promoted).toBe(false);
    expect(plan.page).toEqual(a4);
    expect(plan.pt).toBeGreaterThanOrEqual(7);
  });

  it("exposes the thesis and block thresholds used by the editor", () => {
    expect(printThresholds.thesis).toBe(7);
    expect(printThresholds.block).toBe(6);
  });

  it("is page-aware: layout optimises for the A3 content box it will print on", () => {
    const a3: PageSettings = { ...DEFAULT_PAGE, size: "a3" };
    const boxes = contentBoxes(a3);
    expect(boxes.length).toBe(2); // auto → portrait + landscape
    const portrait = boxes[0];
    expect(portrait.w).toBeCloseTo((297 - 40) * 96 / 25.4, 0);
    expect(portrait.h).toBeCloseTo((420 - 40 - 14) * 96 / 25.4, 0);
    const laid: any = layout(floodIR, boxes);
    const fit = computeFit(laid.canvas.width, laid.canvas.height, { ...a3, orientation: "portrait" }, 14);
    const plainFit = computeFit(
      (layout(floodIR) as any).canvas.width,
      (layout(floodIR) as any).canvas.height,
      { ...a3, orientation: "portrait" },
      14
    );
    expect(fit.scale).toBeGreaterThanOrEqual(plainFit.scale);
  });
});

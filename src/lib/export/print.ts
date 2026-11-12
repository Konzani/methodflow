import type { IR } from "@/lib/core/ir";
import { layout } from "@/lib/core/layout";
import { computeFit, contentBoxes, DEFAULT_PAGE, pageSizeMM, type PageSettings, type PageSize } from "./page";

export type PrintLevel = "good" | "ok" | "small";
export type PrintInfo = { pt: number; level: PrintLevel; nodes: number };
export type PrintPlan = {
  /** Page to export on (size + explicit orientation). */
  page: PageSettings;
  /** Printed node-label size on `page`. */
  pt: number;
  /** Printed size on the user's current page, for the explanation message. */
  basePt: number;
  level: PrintLevel;
  /** True when the plan moved away from the user's page to reach a readable size. */
  promoted: boolean;
  reason: string;
};

const NODE_FONT_PX = 13;
const THESIS_PT = 7;
const BLOCK_PT = 6;
const RESERVE_MM = 14;

export const printLevel = (pt: number): PrintLevel => (pt >= 7 ? "good" : pt >= 5.5 ? "ok" : "small");

export function printPt(ir: IR, page: PageSettings = DEFAULT_PAGE, reserveMM = RESERVE_MM): number {
  // Page-aware layout: the engine optimises folding for this page's content box.
  const laid = layout(ir, contentBoxes(page, reserveMM)) as IR & { canvas?: { width: number; height: number } };
  const c = laid.canvas ?? { width: 600, height: 600 };
  return NODE_FONT_PX * 0.75 * computeFit(c.width, c.height, page, reserveMM).scale;
}

export function printInfo(ir: IR, page: PageSettings = DEFAULT_PAGE, reserveMM = RESERVE_MM): PrintInfo {
  const pt = printPt(ir, page, reserveMM);
  return { pt, level: printLevel(pt), nodes: ir.nodes.length };
}

const SIZES: Exclude<PageSize, "custom">[] = ["a5", "letter", "a4", "legal", "a3"];

/**
 * Choose the export page with the best chance of being thesis-ready.
 *
 * The user's page is kept when it already reaches 7 pt. Otherwise the smallest larger page
 * (A4, then A3, then legal, either orientation) that reaches 7 pt is chosen, so a dense figure
 * is never silently exported as a 2 pt A5 page. If nothing reaches 7 pt, the largest available
 * size is returned with an explanatory reason; the caller blocks exports below 6 pt.
 */
export function bestPrintPlan(ir: IR, base: PageSettings, reserveMM = RESERVE_MM): PrintPlan {
  const basePt = printPt(ir, base, reserveMM);
  if (basePt >= THESIS_PT) {
    return { page: base, pt: basePt, basePt, level: printLevel(basePt), promoted: false, reason: "" };
  }
  const baseMM = pageSizeMM(base);
  const baseArea = baseMM.w * baseMM.h;
  const candidates: { page: PageSettings; pt: number; area: number }[] = [];
  for (const size of SIZES) {
    for (const orientation of ["portrait", "landscape"] as const) {
      const page: PageSettings = { ...base, size, orientation };
      const mm = pageSizeMM(page);
      candidates.push({ page, pt: printPt(ir, page, reserveMM), area: mm.w * mm.h });
    }
  }
  const good = candidates.filter((x) => x.pt >= THESIS_PT && x.area >= baseArea).sort((a, b) => a.area - b.area || b.pt - a.pt);
  const best = good[0] ?? [...candidates].sort((a, b) => b.pt - a.pt || a.area - b.area)[0];
  const promoted = best.page.size !== base.size || best.page.orientation !== base.orientation;
  return {
    page: best.page,
    pt: best.pt,
    basePt,
    level: printLevel(best.pt),
    promoted,
    reason: promoted
      ? `${base.size.toUpperCase()} ${base.orientation} would print labels at ${basePt.toFixed(1)} pt; ${best.page.size.toUpperCase()} ${best.page.orientation} prints them at ${best.pt.toFixed(1)} pt.`
      : "",
  };
}

export const printThresholds = { thesis: THESIS_PT, block: BLOCK_PT };

import type { IR } from "@/lib/core/ir";
import { layout } from "@/lib/core/layout";
import { computeFit, DEFAULT_PAGE, type PageSettings } from "./page";

export type PrintInfo = { pt: number; level: "good" | "ok" | "small"; nodes: number };

const NODE_FONT_PX = 13;

export function printInfo(ir: IR, page: PageSettings = DEFAULT_PAGE, reserveMM = 14): PrintInfo {
  const laid = layout(ir) as IR & { canvas?: { width: number; height: number } };
  const c = laid.canvas ?? { width: 600, height: 600 };
  const fit = computeFit(c.width, c.height, page, reserveMM);
  const pt = NODE_FONT_PX * 0.75 * fit.scale;
  return { pt, level: pt >= 7 ? "good" : pt >= 5.5 ? "ok" : "small", nodes: ir.nodes.length };
}

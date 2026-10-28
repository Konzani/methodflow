import type { IR } from "./ir";
import { DEFAULT_PALETTE_ID } from "./palettes";

export function migrate(raw: unknown): IR | null {
  if (!raw || typeof raw !== "object") return null;
  const ir = raw as IR & { version?: string };
  const needs = ir.version === "1.0" || !ir.meta?.paletteId || !ir.meta?.flowDirection || !ir.meta?.density;
  if (!needs) return ir;
  return {
    ...ir,
    version: "1.1",
    meta: {
      ...ir.meta,
      paletteId: ir.meta?.paletteId ?? DEFAULT_PALETTE_ID,
      density: ir.meta?.density ?? "spacious", // Default changed to Spacious
      flowDirection: ir.meta?.flowDirection ?? "tb",
    },
  } as IR;
}
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
      // "spacious" + "tb" made every migrated diagram print tall and small; a balanced,
      // page-aware layout is the better starting point. Explicit user choices are kept.
      density: ir.meta?.density ?? "balanced",
      flowDirection: ir.meta?.flowDirection ?? "auto",
    },
  } as IR;
}
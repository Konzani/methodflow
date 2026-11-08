import type { IR } from "./ir";

export function withStyle(next: IR, prev: IR["meta"] | undefined): IR {
  return {
    ...next,
    meta: {
      ...next.meta,
      paletteId: prev?.paletteId ?? next.meta.paletteId ?? "mono",
      density: prev?.density ?? next.meta.density ?? "balanced",
      flowDirection: prev?.flowDirection ?? next.meta.flowDirection ?? "auto",
    },
  };
}

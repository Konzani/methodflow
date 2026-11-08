import type { IR } from "@/lib/core/ir";

export const captionOf = (ir: IR): string => {
  const t = (ir.meta.caption || ir.meta.title || "").trim().replace(/\s+/g, " ");
  return t && !/[.!?]$/.test(t) ? t + "." : t;
};

export const figureCaption = (ir: IR, n = 1): string => {
  const c = captionOf(ir);
  return c ? `Figure ${n}. ${c}` : "";
};

import { LIMITS } from "./limits";

/**
 * Last-resort normalisation for model output BEFORE schema validation.
 *
 * A single over-long label used to reject the entire diagram (and fall back to a
 * template). Lengths are clamped at word boundaries instead, so the diagram survives
 * while the schema still holds its hard limits.
 */
const cut = (v: unknown, max: number): unknown => {
  if (typeof v !== "string") return v;
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const at = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(","), slice.lastIndexOf(";"), slice.lastIndexOf(":"));
  const keep = at >= max * 0.55 ? slice.slice(0, at) : slice;
  return keep.trim() + "…";
};

export function coerceGeneratedIR(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const j = raw as Record<string, any>;
  if (j.meta && typeof j.meta === "object") {
    j.meta.title = cut(j.meta.title, 120);
    j.meta.caption = cut(j.meta.caption, 300);
  }
  if (Array.isArray(j.groups)) {
    for (const g of j.groups) if (g && typeof g === "object") g.label = cut(g.label, 60);
  }
  if (Array.isArray(j.nodes)) {
    for (const n of j.nodes) {
      if (!n || typeof n !== "object") continue;
      n.label = cut(n.label, LIMITS.labelCharsMax);
      n.notes = cut(n.notes, 300);
    }
  }
  if (Array.isArray(j.edges)) {
    for (const e of j.edges) if (e && typeof e === "object") e.label = cut(e.label, 40);
  }
  return j;
}

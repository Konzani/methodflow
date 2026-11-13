import { describe, expect, it } from "vitest";
import { coerceGeneratedIR } from "@/lib/core/coerce";
import { LIMITS } from "@/lib/core/limits";
import { IRSchema } from "@/lib/core/ir";

const base = () => ({
  version: "1.1",
  meta: { title: "Short title", methodology: "custom", caption: "Short caption." },
  groups: [{ id: "g1", label: "Data preparation" }],
  nodes: [
    { id: "n1", label: "Define the study area", shape: "terminator", groupId: "g1" },
    { id: "n2", label: "Process the imagery", shape: "process", groupId: "g1" },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
});

describe("model-output coercion", () => {
  it("keeps ordinary diagrams unchanged", () => {
    const j: any = coerceGeneratedIR(base());
    expect(j).toEqual(base());
    expect(IRSchema.safeParse(j).success).toBe(true);
  });

  it("clamps an over-long node label at a word boundary instead of rejecting the diagram", () => {
    const raw: any = base();
    raw.nodes[1].label =
      "Download Landsat 8 OLI scenes for 2014 and 2024 (path 169, row 060) from USGS EarthExplorer together with Sentinel-2 imagery for independent validation";
    expect(raw.nodes[1].label.length).toBeGreaterThan(LIMITS.labelCharsMax);
    const j: any = coerceGeneratedIR(raw);
    expect(j.nodes[1].label.length).toBeLessThanOrEqual(LIMITS.labelCharsMax);
    expect(j.nodes[1].label.endsWith("…")).toBe(true);
    expect(j.nodes[1].label).not.toMatch(/\s…$/);
    expect(IRSchema.safeParse(j).success).toBe(true);
  });

  it("clamps titles, captions, edge labels and notes to schema limits", () => {
    const raw: any = base();
    raw.meta.title = "T".repeat(200);
    raw.meta.caption = "C".repeat(400);
    raw.edges[0].label = "E".repeat(80);
    raw.nodes[0].notes = "N".repeat(400);
    const j: any = coerceGeneratedIR(raw);
    expect(j.meta.title.length).toBeLessThanOrEqual(120);
    expect(j.meta.caption.length).toBeLessThanOrEqual(300);
    expect(j.edges[0].label.length).toBeLessThanOrEqual(40);
    expect(j.nodes[0].notes.length).toBeLessThanOrEqual(300);
    expect(IRSchema.safeParse(j).success).toBe(true);
  });

  it("does not invent labels for missing values", () => {
    const raw: any = base();
    delete raw.nodes[1].label;
    const j: any = coerceGeneratedIR(raw);
    expect(j.nodes[1].label).toBeUndefined();
    expect(IRSchema.safeParse(j).success).toBe(false);
  });
});

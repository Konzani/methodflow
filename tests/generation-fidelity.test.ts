import { describe, expect, it } from "vitest";
import { EXAMPLE_JSON, REFINE_SYSTEM, systemPrompt } from "@/lib/core/prompt";
import { numberFidelity, qualityIssues } from "@/lib/core/quality";
import { IRSchema } from "@/lib/core/ir";
import { validateGraph } from "@/lib/core/validate";

const example = () => IRSchema.parse(JSON.parse(EXAMPLE_JSON));
const source = "The basin covers 12,900 km² and the study used 85 community reports, 6 gauging stations and a 70/30 split with an AUC threshold of 0.80.";

describe("generation policy v2", () => {
  const p = systemPrompt(true);

  it("forbids diagram-management nodes and requires branch labels", () => {
    expect(p).toMatch(/BRANCHES, MERGES AND EDGE LABELS/);
    expect(p).toMatch(/Never create a process node that only describes diagram structure/);
    expect(p).toMatch(/Label each fork edge with the branch/);
    expect(p).toMatch(/explicit edge from every\s+contributing branch/);
  });

  it("requires numbers and acronym expansion", () => {
    expect(p).toMatch(/12,900 km²/);
    expect(p).toMatch(/Every number, count, unit, year/);
    expect(p).toMatch(/Expand an acronym at first use/);
  });

  it("refine system keeps the same branch/number rules", () => {
    expect(REFINE_SYSTEM).toMatch(/Never introduce "split\/merge" process nodes/);
    expect(REFINE_SYSTEM).toMatch(/Preserve every number already present/);
  });

  it("worked example is still schema-valid, clean and non-linear", () => {
    const ir = example();
    expect(validateGraph(ir, true)).toEqual([]);
    expect(qualityIssues(ir, { method: "mixed", rich: true })).toEqual([]);
    expect(ir.edges.filter((e) => e.source === "n6").every((e) => !!e.label)).toBe(true);
  });
});

describe("quality rubric v2", () => {
  it("flags labels that only describe the diagram", () => {
    const ir = example();
    ir.nodes[2].label = "Split satellite evidence into two sub-branches";
    const issues = qualityIssues(ir, { method: "mixed", rich: false });
    expect(issues.join(" ")).toMatch(/describe the diagram instead of the method/);
  });

  it("flags an unlabelled fork", () => {
    const ir = example();
    ir.edges = ir.edges.map((e) => (e.source === "n6" ? { ...e, label: undefined } : e));
    const issues = qualityIssues(ir, { method: "mixed", rich: false });
    expect(issues.join(" ")).toMatch(/Fork steps without labelled branches/);
  });

  it("flags numbers that are in the source but missing from the diagram", () => {
    const ir = example();
    const issues = qualityIssues(ir, { method: "mixed", rich: false, source });
    expect(issues.join(" ")).toMatch(/missing from the diagram/);
    expect(issues.join(" ")).toMatch(/12,900|85|70|0\.80/);
  });

  it("numberFidelity keeps working for invented and missing values", () => {
    const ir = example();
    ir.nodes[1].label = "Sample 384 respondents";
    const f = numberFidelity(ir, "sample of 384 respondents");
    expect(f.invented).toEqual([]);
    expect(f.missing).toEqual([]);
    const invented = numberFidelity(ir, "no numbers here");
    expect(invented.invented).toContain("384");
    const g = numberFidelity(example(), "12,900 km²");
    expect(g.missing).toContain("12900");
  });
});

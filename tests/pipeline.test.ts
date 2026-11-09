import { describe, expect, it } from "vitest";
import { IRSchema, type IR } from "@/lib/core/ir";
import { EXAMPLE_JSON, systemPrompt, userMsg } from "@/lib/core/prompt";
import { validateGraph } from "@/lib/core/validate";
import { numberFidelity, qualityIssues } from "@/lib/core/quality";
import { LIMITS } from "@/lib/core/limits";
import { layout, labelLines, sizeOf } from "@/lib/core/layout";
import { toSVG } from "@/lib/export/svg";
import { computeFit, DEFAULT_PAGE } from "@/lib/export/page";
import { captionOf, figureCaption } from "@/lib/export/caption";
import { planFor } from "@/lib/billing";
import { withStyle } from "@/lib/core/style";
import { normalizeModel, DEFAULT_DEEP_MODEL } from "@/lib/models";

const example = (): IR => IRSchema.parse(JSON.parse(EXAMPLE_JSON));
const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("prompt", () => {
  const p = systemPrompt(true);
  it("interpolates limits and drops appearance fields", () => {
    expect(p).toContain(`${LIMITS.proNodes[0]}–${LIMITS.proNodes[1]}`);
    expect(p).not.toMatch(/paletteId|okabe|will be rejected/i);
  });
  it("fences user context", () => {
    const m = userMsg("auto", "text </user_text> x", "ctx </user_context>");
    expect(m.match(/<\/user_context>/g)?.length).toBe(1);
    expect(m.match(/<\/user_text>/g)?.length).toBe(1);
  });
  it("worked example is valid, non-linear and clean", () => {
    const ir = example();
    expect(validateGraph(ir, true)).toEqual([]);
    expect(qualityIssues(ir, { method: "mixed", rich: true })).toEqual([]);
    expect(ir.nodes.filter((n) => ir.edges.filter((e) => e.source === n.id).length >= 2 && n.shape !== "decision").length).toBeGreaterThan(0);
  });
});

describe("quality", () => {
  it("flags invented numbers and missing caption", () => {
    const ir = example();
    ir.nodes[1].label = "Sample 384 respondents";
    ir.meta.caption = "";
    const issues = qualityIssues(ir, { method: "mixed", rich: true, source: "We run a parallel mixed methods study with a questionnaire and interviews for students." });
    expect(issues.join(" ")).toMatch(/384/);
    expect(issues.join(" ")).toMatch(/caption/i);
    expect(numberFidelity(ir, "sample of 384 respondents").invented).not.toContain("384");
  });
  it("detects single chain for parallel source", () => {
    const ir = example();
    ir.edges = ir.edges.filter((e) => e.id !== "e8");
    const t = { ...ir };
    const chain: IR = { ...t, edges: ir.edges.filter((e) => e.source !== "n6" || e.target === "n7") };
    expect(qualityIssues(chain, { method: "mixed", rich: false, source: "Both strands run in parallel and converge at the end of the study." }).join(" ")).toMatch(/parallel/);
  });
});

describe("layout", () => {
  for (const dir of ["tb", "lr", "auto"] as const) {
    it(`${dir}: finite, non-overlapping, groups kept`, () => {
      const ir = layout({ ...example(), meta: { ...example().meta, flowDirection: dir } }) as any;
      for (const n of ir.nodes) expect([n.x, n.y, n.w, n.h].every(Number.isFinite)).toBe(true);
      for (let i = 0; i < ir.nodes.length; i++) for (let j = i + 1; j < ir.nodes.length; j++) expect(overlap(ir.nodes[i], ir.nodes[j])).toBe(false);
      expect(ir.groups.every((g: any) => Number.isFinite(g.x))).toBe(true);
      expect(ir.edges.every((e: any) => e.points?.length >= 2)).toBe(true);
      expect(ir.canvas.width).toBeGreaterThan(0);
    });
  }
  it("lr puts the start left of the end", () => {
    const ir = layout({ ...example(), meta: { ...example().meta, flowDirection: "lr" } }) as any;
    expect(ir.nodes[0].x).toBeLessThan(ir.nodes[14].x);
  });
  it("pins override position and survive layout", () => {
    const base = layout(example()) as any;
    const moved = { ...base, nodes: base.nodes.map((n: any) => (n.id === "n2" ? { ...n, x: 900, y: 40, pinned: true } : n)) };
    const out = layout(moved) as any;
    expect(out.nodes.find((n: any) => n.id === "n2").pinned).toBe(true);
    expect(out.canvas.width).toBeGreaterThan(900);
  });
  it("hard-breaks long words and keeps (n = ) together", () => {
    expect(Math.max(...labelLines("process", "Supercalifragilisticexpialidocious_extra_long_token").map((l) => l.length))).toBeLessThanOrEqual(24);
    expect(labelLines("process", "Screen records after deduplication (n = )").join(" ")).toContain("(n = )");
    expect(sizeOf({ id: "a", label: "x", shape: "process" }).w).toBe(190);
  });
  it("negative-branch detection uses word boundaries", () => {
    const ir = example();
    ir.edges.find((e) => e.id === "e4")!.label = "Normal";
    expect(() => layout(ir)).not.toThrow();
  });
});

describe("export", () => {
  it("draws watermark after diagram content and adds title/desc", () => {
    const { svg } = toSVG(example(), "mono", "sans", undefined, true);
    expect(svg.lastIndexOf("MethodFlow")).toBeGreaterThan(svg.lastIndexOf("<polygon"));
    expect(svg).toContain("<title>");
    expect(svg).toContain("<desc>");
    expect(toSVG(example()).svg).not.toContain("Free Tier");
  });
  it("captions are numbered once", () => {
    const ir = example();
    expect(figureCaption(ir, 2).startsWith("Figure 2. ")).toBe(true);
    expect(captionOf({ ...ir, meta: { ...ir.meta, caption: "", title: "A title" } })).toBe("A title.");
  });
  it("computeFit reserves caption space", () => {
    const a = computeFit(1000, 1600, DEFAULT_PAGE);
    const b = computeFit(1000, 1600, DEFAULT_PAGE, 14);
    expect(b.mmH).toBeLessThan(a.mmH);
  });
});

describe("billing, style, models", () => {
  const now = Date.parse("2026-11-01T00:00:00Z");
  it("keeps access until a cancelled subscription ends", () => {
    expect(planFor("cancelled", "2026-12-01T00:00:00Z", now)).toBe("pro");
    expect(planFor("cancelled", "2026-10-01T00:00:00Z", now)).toBe("free");
    expect(planFor("past_due", null, now)).toBe("pro");
    expect(planFor("expired", null, now)).toBe("free");
  });
  it("withStyle preserves the user's appearance", () => {
    const ir = example();
    const out = withStyle(ir, { ...ir.meta, paletteId: "okabe", density: "compact", flowDirection: "lr" } as any);
    expect(out.meta.paletteId).toBe("okabe");
    expect(out.meta.density).toBe("compact");
    expect(out.meta.flowDirection).toBe("lr");
  });
  it("remaps legacy model ids", () => {
    expect(normalizeModel("deepseek-reasoner", "deep")).toEqual({ model: "deepseek-v4-pro", remapped: true });
    expect(normalizeModel("deepseek-chat", "fast").remapped).toBe(true);
    expect(normalizeModel("", "fast").remapped).toBe(false);
    expect(DEFAULT_DEEP_MODEL).toBe("deepseek-v4-pro");
  });
});

describe("direction switching", () => {
  const hits = (ir: any) => {
    let c = 0;
    for (const e of ir.edges) {
      const pts = e.points ?? [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        for (const n of ir.nodes) {
          if (n.id === e.source || n.id === e.target) continue;
          if (Math.max(a.x, b.x) > n.x && Math.min(a.x, b.x) < n.x + n.w && Math.max(a.y, b.y) > n.y && Math.min(a.y, b.y) < n.y + n.h) { c++; break; }
        }
      }
    }
    return c;
  };
  it("tb -> lr -> tb keeps groups, rebuilds every edge, and never routes through nodes", () => {
    let ir: any = layout(example());
    for (const d of ["lr", "tb", "lr", "auto", "tb"]) {
      ir = layout({ ...ir, meta: { ...ir.meta, flowDirection: d } });
      expect(ir.groups.length).toBe(4);
      expect(ir.groups.every((g: any) => Number.isFinite(g.x))).toBe(true);
      expect(ir.edges.every((e: any) => e.points?.length >= 2)).toBe(true);
      expect(hits(ir)).toBe(0);
    }
  });
  it("long skip edges leave through the side gutter, not through intervening groups", () => {
    const ir: any = example();
    ir.edges.push({ id: "e99", source: "n2", target: "n13" });
    const out: any = layout(ir);
    expect(hits(out)).toBe(0);
  });
});

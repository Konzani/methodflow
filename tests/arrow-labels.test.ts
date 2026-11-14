import { describe, expect, it } from "vitest";
import { layout } from "@/lib/core/layout";
import { toSVG } from "@/lib/export/svg";
import { contentBoxes, DEFAULT_PAGE, type PageSettings } from "@/lib/export/page";
import { floodIR } from "./fixtures/flood";

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box, pad = 0) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

function withForkLabels() {
  const ir: any = JSON.parse(JSON.stringify(floodIR));
  const forks: [string, string, string][] = [
    ["n2", "n3", "Satellite evidence"],
    ["n2", "n9", "Terrain evidence"],
    ["n2", "n12", "Ground evidence"],
  ];
  for (const [source, target, label] of forks) {
    const e = ir.edges.find((x: any) => x.source === source && x.target === target);
    if (e) e.label = label;
  }
  return ir;
}

const arrowWidth = (svg: string) => Number((svg.match(/data-arrow-px="([\d.]+)"/) ?? [])[1]);
const arrowCount = (svg: string) => (svg.match(/data-arrow="1"/g) ?? []).length;
const expectedPt = (svg: string, w: number, h: number, page: PageSettings) => {
  const boxes = contentBoxes(page);
  const scale = Math.max(...boxes.map((b) => Math.min(1, b.w / w, b.h / h)));
  return arrowWidth(svg) * 0.75 * scale;
};

describe("arrowhead print sizing", () => {
  it("keeps a ~3.5 pt arrowhead when a large diagram is fitted to A4 or A3", () => {
    for (const size of ["a4", "a3"] as const) {
      const page: PageSettings = { ...DEFAULT_PAGE, size };
      const { svg, w, h } = toSVG(floodIR, "mono", "sans", undefined, false, contentBoxes(page));
      const pt = expectedPt(svg, w, h, page);
      expect(pt).toBeGreaterThanOrEqual(3.3);
      expect(pt).toBeLessThanOrEqual(3.7);
    }
  });

  it("grows the marker as the page fit shrinks", () => {
    const small = toSVG(floodIR, "mono", "sans", undefined, false, [{ w: 420, h: 300 }]);
    const a4 = toSVG(floodIR, "mono", "sans", undefined, false, contentBoxes({ ...DEFAULT_PAGE, size: "a4" }));
    expect(arrowWidth(small.svg)).toBeGreaterThan(arrowWidth(a4.svg));
  });

  it("keeps a sensible fixed marker for inline previews without page boxes", () => {
    const { svg } = toSVG(floodIR);
    expect(arrowWidth(svg)).toBe(9);
  });

  it("draws every arrowhead as an explicit polygon (renderers that drop SVG markers still show them)", () => {
    const { svg } = toSVG(floodIR, "mono", "sans", undefined, false, contentBoxes({ ...DEFAULT_PAGE, size: "a4" }));
    expect(arrowCount(svg)).toBe(floodIR.edges.length);
    expect(svg).not.toMatch(/<marker\b/);
  });
});

describe("edge label placement", () => {
  it("keeps fork labels out of nodes, phase-title bands and each other", () => {
    const o: any = layout(withForkLabels());
    const labels: { rect: Box; text: string }[] = [];

    for (const e of o.edges) {
      if (!e.label || !e.labelPos) continue;
      const w = Math.max(22, e.label.length * 6.2 + 10);
      const rect: Box = { x: e.labelPos.x - w / 2, y: e.labelPos.y - 7.5, w, h: 15 };
      labels.push({ rect, text: e.label });

      for (const n of o.nodes) {
        const nb: Box = { x: n.x, y: n.y, w: n.w, h: n.h };
        expect(overlaps(rect, nb, 2), `${e.label} overlaps node ${n.id}`).toBe(false);
      }
      for (const g of o.groups) {
        const header: Box = { x: g.x + 4, y: g.y + 2, w: g.w - 8, h: 22 };
        expect(overlaps(rect, header, 1), `${e.label} overlaps phase title in ${g.id}`).toBe(false);
      }
    }

    expect(labels.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        expect(overlaps(labels[i].rect, labels[j].rect, 2), `${labels[i].text} overlaps ${labels[j].text}`).toBe(false);
      }
    }
  });

  it("offsets a branch label away from the fork node", () => {
    const o: any = layout(withForkLabels());
    const n2 = o.nodes.find((n: any) => n.id === "n2");
    const branch = o.edges.find((e: any) => e.label === "Satellite evidence");
    const w = Math.max(22, branch.label.length * 6.2 + 10);
    const rect: Box = { x: branch.labelPos.x - w / 2, y: branch.labelPos.y - 7.5, w, h: 15 };
    expect(overlaps(rect, { x: n2.x, y: n2.y, w: n2.w, h: n2.h }, 6)).toBe(false);
  });
});

import type { IR } from "@/lib/core/ir";
import { layout } from "@/lib/core/layout";

export const tex = (s: string) =>
  s.replace(/[\\&%$#_{}~^]/g, (c) =>
    c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\textasciitilde{}" : c === "^" ? "\\textasciicircum{}" : "\\" + c
  );

// Fallback sizes for TikZ, since the new engine calculates exact w/h dynamically
const size = (s: string) =>
  s === "decision" ? { w: 220, h: 110 }
  : s === "terminator" ? { w: 180, h: 56 }
  : s === "database" ? { w: 210, h: 86 }
  : { w: 220, h: 70 };

const ST: Record<string, string> = {
  process: "rectangle",
  decision: "diamond, aspect=2.2, inner sep=0pt",
  terminator: "rectangle, rounded corners=0.4cm",
  data: "trapezium, trapezium left angle=70, trapezium right angle=110",
  document: "tape, tape bend top=none",
  database: "cylinder, shape border rotate=90, aspect=0.25"
};

export function toTikz(src: IR) {
  // 1. Run the layout engine to get exact coordinates
  const ir = layout(src);
  const k = 72; // scale factor

  const N = (n: any) => {
    const z = size(n.shape);
    return `  \\node[${n.shape}] (${"n" + ir.nodes.indexOf(n)}) at (${(n.x + z.w / 2) / k},${-((n.y + z.h / 2) / k)}) {${tex(n.label)}};`;
  };

  const idx = (id: string) => "n" + ir.nodes.findIndex((n: any) => n.id === id);

  const head = `% Requires: \\usepackage{tikz} \\usetikzlibrary{shapes.geometric,shapes.symbols,arrows.meta}\n\\begin{tikzpicture}[\n  every node/.style={draw, align=center, font=\\small, text width=2.5cm, minimum height=0.9cm, inner sep=3pt},\n${Object.entries(ST).map(([a, b]) => `  ${a}/.style={${b}}`).join(",\n")},\n  >={Stealth}\n]`;

  const edges = ir.edges.map((e: any) => `  \\draw[->${e.dashed ? ",dashed" : ""}] (${idx(e.source)}) -- ${e.label ? `node[midway, right, draw=none, minimum height=0pt, text width=1.2cm, align=left, font=\\footnotesize] {${tex(e.label)}} ` : ""}(${idx(e.target)});`);

  return [head, ...ir.nodes.map(N), ...edges, "\\end{tikzpicture}"].join("\n");
}
import type { IR, N } from "@/lib/core/ir";
import { layout, labelLines } from "@/lib/core/layout";
import { getPalette, groupTint, type Palette } from "@/lib/core/palettes";

export type Theme = "mono" | "tint";
export type Font = "sans" | "serif";

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const colors = (n: N, p: Palette) => {
  const s = p.shapes[n.shape];
  return { fill: n.fill ?? s.fill, stroke: n.stroke ?? s.stroke, text: n.text ?? s.text };
};

function shape(n: N, x: number, y: number, w: number, h: number, fill: string, stroke: string, sw = 1.5) {
  const a = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
  switch (n.shape) {
    case "decision":
      return `<polygon ${a} points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}"/>`;
    case "terminator":
      return `<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    case "data":
      return `<polygon ${a} points="${x + 14},${y} ${x + w},${y} ${x + w - 14},${y + h} ${x},${y + h}"/>`;
    case "document":
      return `<path ${a} d="M${x},${y} h${w} v${h - 10} q${-w / 4},16 ${-w / 2},0 t${-w / 2},0 z"/>`;
    case "database":
      return `<path ${a} d="M${x},${y + 8} a${w / 2},8 0 0 1 ${w},0 v${h - 16} a${w / 2},8 0 0 1 ${-w},0 z"/><path fill="none" stroke="${stroke}" stroke-width="${sw}" d="M${x},${y + 8} a${w / 2},8 0 0 0 ${w},0"/>`;
    default:
      return `<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
  }
}

export function toSVG(src: IR, theme: Theme = "mono", font: Font = "sans", paletteOverride?: Palette, watermark = false) {
  const laidOut = layout(src) as any;
  const W = laidOut.canvas.width;
  const H = laidOut.canvas.height;

  const pal = paletteOverride ?? getPalette(laidOut.meta?.paletteId ?? theme);
  const ink = pal.ink;
  const ff = font === "serif" ? "'Times New Roman',Times,serif" : "Arial,Helvetica,sans-serif";

  const groups = laidOut.groups
    .map((g: any, i: number) => {
      if (g.x === undefined) return "";
      const tint = g.color ?? groupTint(pal, i);
      return `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6" fill="${tint}" stroke="${pal.accent}" stroke-opacity="0.15" stroke-width="1"/>
            <text x="${g.x + 10}" y="${g.y + 18}" font-size="11" fill="${pal.accent}" font-weight="600" letter-spacing="0.04em">${esc((g.label ?? "").toUpperCase())}</text>`;
    })
    .join("");

  const edges = laidOut.edges
    .map((e: any) => {
      const source = laidOut.nodes.find((n: any) => n.id === e.source);
      const target = laidOut.nodes.find((n: any) => n.id === e.target);
      if (!source || !target) return "";

      let pathD = "";
      let labelX = 0,
        labelY = 0;
      if (e.points && e.points.length) {
        pathD = e.points.map((p: any, i: number) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
        if (e.labelPos) {
          labelX = e.labelPos.x;
          labelY = e.labelPos.y;
        }
      } else {
        const sx = source.x + (source.w || 200) / 2;
        const sy = source.y + (source.h || 60);
        const tx = target.x + (target.w || 200) / 2;
        const ty = target.y;
        const midY = (sy + ty) / 2;
        pathD = `M${sx},${sy} C${sx},${midY} ${tx},${midY} ${tx},${ty}`;
        labelX = (sx + tx) / 2;
        labelY = midY;
      }
      const lab = e.label
        ? `<rect x="${labelX - 4}" y="${labelY - 14}" width="${Math.max(e.label.length * 6 + 8, 20)}" height="14" rx="2" fill="#fff"/><text x="${labelX}" y="${labelY - 3}" font-size="11" fill="${ink}" text-anchor="middle">${esc(e.label)}</text>`
        : "";
      return `<path d="${pathD}" fill="none" stroke="${ink}" stroke-width="1.3"${e.dashed ? ' stroke-dasharray="6 4"' : ""} marker-end="url(#a)"/>${lab}`;
    })
    .join("");

  const nodes = laidOut.nodes
    .map((n: any) => {
      const c = colors(n, pal);
      const L = labelLines(n.shape, n.label);
      const lh = 15;
      const y0 = n.y + n.h / 2 - ((L.length - 1) * lh) / 2 + 4 + (n.shape === "database" ? 5 : 0);
      return (
        shape(n, n.x, n.y, n.w, n.h, c.fill, c.stroke) +
        `<text font-size="13" fill="${c.text}" text-anchor="middle">${L.map(
          (l: string, i: number) => `<tspan x="${n.x + n.w / 2}" y="${y0 + i * lh}">${esc(l)}</tspan>`
        ).join("")}</text>`
      );
    })
    .join("");

  const long = Math.max(W, H);
  const short = Math.min(W, H);
  const tiles = Math.max(1, Math.min(4, Math.round(long / short)));
  const fontSize = Math.min(short / 3.5, 120);
  const marks = Array.from({ length: tiles }, (_, i) => {
    const f = (i + 0.5) / tiles;
    const cx = W >= H ? W * f : W / 2;
    const cy = W >= H ? H / 2 : H * f;
    return `<g transform="translate(${cx}, ${cy}) rotate(-35)"><text x="0" y="0" font-family="Georgia, serif" font-size="${fontSize}" fill="#12161B" opacity="0.09" font-weight="900" text-anchor="middle" dominant-baseline="central" letter-spacing="0.15em">MethodFlow</text></g>`;
  }).join("");
  const watermarkSvg = watermark
    ? `${marks}<text x="${W - 24}" y="${H - 16}" font-family="Arial, sans-serif" font-size="12" fill="#6b7280" text-anchor="end" font-style="italic">Generated with MethodFlow (Free Tier)</text>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ff}" role="img" aria-label="${esc(laidOut.meta.title)}"><title>${esc(laidOut.meta.title)}</title><desc>${esc(laidOut.meta.caption ?? "")}</desc>
    <defs>
      <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker>
    </defs>
    <rect width="100%" height="100%" fill="${pal.canvas}"/>
    ${groups}${edges}${nodes}
    ${watermarkSvg}
  </svg>`;

  return { svg, w: W, h: H };
}
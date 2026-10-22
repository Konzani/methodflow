import type{IR,N}from"@/lib/core/ir";
import{layout}from"@/lib/core/layout";
import{getPalette,groupTint,type Palette}from"@/lib/core/palettes";
export type Theme="mono"|"tint";
export type Font="sans"|"serif";
export const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] as string));

const wrap=(s:string,max:number)=>{const out:string[]=[];let l="";for(const w of s.replace(/\(n = \)/g,"(n\u00A0=\u00A0)").split(/ +/)){if(l&&(l+" "+w).length>max){out.push(l);l=w}else l=l?l+" "+w:w}if(l)out.push(l);return out.slice(0,4)};
const colors=(n:N,p:Palette)=>{const s=p.shapes[n.shape];return{fill:n.fill??s.fill,stroke:n.stroke??s.stroke,text:n.text??s.text}};

function shape(n:N,x:number,y:number,w:number,h:number,fill:string,stroke:string,sw=1.5){
  const a=`fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
  switch(n.shape){
    case"decision":return`<polygon ${a} points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}"/>`;
    case"terminator":return`<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}"/>`;
    case"data":return`<polygon ${a} points="${x+14},${y} ${x+w},${y} ${x+w-14},${y+h} ${x},${y+h}"/>`;
    case"document":return`<path ${a} d="M${x},${y} h${w} v${h-10} q${-w/4},16 ${-w/2},0 t${-w/2},0 z"/>`;
    case"database":return`<path ${a} d="M${x},${y+8} a${w/2},8 0 0 1 ${w},0 v${h-16} a${w/2},8 0 0 1 ${-w},0 z"/><path fill="none" stroke="${stroke}" stroke-width="${sw}" d="M${x},${y+8} a${w/2},8 0 0 0 ${w},0"/>`;
    default:return`<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
  }
}

export function toSVG(src:IR,theme:Theme="mono",font:Font="sans",paletteOverride?:Palette,watermark=false){
  // 1. Run the new deterministic layout engine
  const laidOut = layout(src) as any;
  const W = laidOut.canvas.width;
  const H = laidOut.canvas.height;
  
  const pal=paletteOverride??getPalette(laidOut.meta?.paletteId??theme);
  const ink=pal.ink;
  const ff=font==="serif"?"'Times New Roman',Times,serif":"Arial,Helvetica,sans-serif";

  // 2. Draw groups exactly where the layout engine placed them
  const groups = laidOut.groups.map((g:any, i:number) => {
    if (g.x === undefined) return "";
    const tint = g.color ?? groupTint(pal, i);
    return `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="6" fill="${tint}" stroke="${pal.accent}" stroke-opacity="0.15" stroke-width="1"/>
            <text x="${g.x + 10}" y="${g.y + 18}" font-size="11" fill="${pal.accent}" font-weight="600" letter-spacing="0.04em">${esc((g.label??"").toUpperCase())}</text>`;
  }).join("");

  // 3. Draw edges using the exact points calculated by the engine
  const edges = laidOut.edges.map((e:any) => {
    if (!e.points || !e.points.length) return "";
    const d = e.points.map((p:any, i:number) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
    const lab = e.labelPos && e.label ? `<rect x="${e.labelPos.x-4}" y="${e.labelPos.y-14}" width="${Math.max(e.label.length*6+8,20)}" height="14" rx="2" fill="#fff"/><text x="${e.labelPos.x}" y="${e.labelPos.y-3}" font-size="11" fill="${ink}" text-anchor="${e.labelPos.anchor}">${esc(e.label)}</text>` : "";
    return `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.3"${e.dashed?' stroke-dasharray="6 4"':''} marker-end="url(#a)"/>${lab}`;
  }).join("");

  // 4. Draw nodes using the exact w/h calculated by the engine
  const nodes = laidOut.nodes.map((n:any) => {
    const c = colors(n, pal);
    const L = wrap(n.label, n.shape === "decision" ? 16 : n.shape === "database" ? 20 : 24);
    const lh = 15;
    const y0 = n.y + n.h / 2 - ((L.length - 1) * lh) / 2 + 4 + (n.shape === "database" ? 5 : 0);
    return shape(n, n.x, n.y, n.w, n.h, c.fill, c.stroke) + 
           `<text font-size="13" fill="${c.text}" text-anchor="middle">${L.map((l:string,i:number)=>`<tspan x="${n.x + n.w/2}" y="${y0+i*lh}">${esc(l)}</tspan>`).join("")}</text>`;
  }).join("");

  // 5. Watermark
  const wmPattern = watermark ? `
    <pattern id="wm-pattern" width="400" height="400" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="20" y="200" font-family="Georgia, serif" font-size="48" fill="#000" opacity="0.03" font-weight="600" letter-spacing="0.05em">MethodFlow</text>
    </pattern>` : "";
  const wmRect = watermark ? `<rect width="100%" height="100%" fill="url(#wm-pattern)" />` : "";
  const wmBadge = watermark ? `<text x="${W - 24}" y="${H - 20}" font-family="Arial, sans-serif" font-size="11" fill="#9ca3af" text-anchor="end" letter-spacing="0.05em">MethodFlow</text>` : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ff}" role="img" aria-label="${esc(laidOut.meta.title)}">
    <defs>
      <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker>
      ${wmPattern}
    </defs>
    <rect width="100%" height="100%" fill="${pal.canvas}"/>
    ${wmRect}${groups}${edges}${nodes}${wmBadge}
  </svg>`;

  return { svg, w: W, h: H };
}
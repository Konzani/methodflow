import type{IR,N}from"@/lib/core/ir";
import{placed,size}from"@/lib/core/layout";
import{getPalette,groupTint,type Palette}from"@/lib/core/palettes";
export type Theme="mono"|"tint";
export type Font="sans"|"serif";
export const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] as string));
const wrap=(s:string,max:number)=>{const out:string[]=[];let l="";for(const w of s.replace(/\(n = \)/g,"(n\u00A0=\u00A0)").split(/ +/)){if(l&&(l+" "+w).length>max){out.push(l);l=w}else l=l?l+" "+w:w}if(l)out.push(l);return out.slice(0,4)};
const colors=(n:N,p:Palette)=>{const s=p.shapes[n.shape];return{fill:n.fill??s.fill,stroke:n.stroke??s.stroke,text:n.text??s.text}};
function shape(n:N,x:number,y:number,w:number,h:number,fill:string,stroke:string,sw=1.5){const a=`fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;switch(n.shape){
case"decision":return`<polygon ${a} points="${x+w/2},${y} ${x+w},${y+h/2} ${x+w/2},${y+h} ${x},${y+h/2}"/>`;
case"terminator":return`<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}"/>`;
case"data":return`<polygon ${a} points="${x+14},${y} ${x+w},${y} ${x+w-14},${y+h} ${x},${y+h}"/>`;
case"document":return`<path ${a} d="M${x},${y} h${w} v${h-10} q${-w/4},16 ${-w/2},0 t${-w/2},0 z"/>`;
case"database":return`<path ${a} d="M${x},${y+8} a${w/2},8 0 0 1 ${w},0 v${h-16} a${w/2},8 0 0 1 ${-w},0 z"/><path fill="none" stroke="${stroke}" stroke-width="${sw}" d="M${x},${y+8} a${w/2},8 0 0 0 ${w},0"/>`;
default:return`<rect ${a} x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`}}

export function toSVG(src:IR,theme:Theme="mono",font:Font="sans",paletteOverride?:Palette,watermark=false){
const ir=placed(src);const pal=paletteOverride??getPalette(ir.meta.paletteId??theme);
const P=48;
const pos=new Map<string,{n:N;x:number;y:number;w:number;h:number}>(ir.nodes.map(n=>[n.id,{n,x:n.x as number,y:n.y as number,...size(n.shape)}] as const));

let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
pos.forEach(p=>{
  minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
  maxX=Math.max(maxX,p.x+p.w);maxY=Math.max(maxY,p.y+p.h);
});
if(minX===Infinity){minX=0;minY=0;maxX=100;maxY=100;}

const W=Math.ceil(maxX-minX+P*2);
const H=Math.ceil(maxY-minY+P*2);
pos.forEach(p=>{p.x=p.x-minX+P;p.y=p.y-minY+P;});

const ink=pal.ink;
const ff=font==="serif"?"'Times New Roman',Times,serif":"Arial,Helvetica,sans-serif";

const groupBox=(gid:string,gi:number)=>{
  const members=[...pos.values()].filter(p=>p.n.groupId===gid);if(!members.length)return"";
  const pad=32;let gx=Infinity,gy=Infinity,gw=0,gh=0;
  members.forEach(m=>{gx=Math.min(gx,m.x);gy=Math.min(gy,m.y);gw=Math.max(gw,m.x+m.w);gh=Math.max(gh,m.y+m.h)});
  const x=gx-pad,y=gy-pad,w=gw-gx+pad*2,h=gh-gy+pad*2;
  const g=ir.groups.find(gg=>gg.id===gid);
  const tint=g?.color??groupTint(pal,gi);
  return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${tint}" stroke="${pal.accent}" stroke-opacity="0.15" stroke-width="1"/><text x="${x+10}" y="${y+18}" font-size="11" fill="${pal.accent}" font-weight="600" letter-spacing="0.04em">${esc((g?.label??"").toUpperCase())}</text>`;
};
const groups=ir.groups.map((g,i)=>groupBox(g.id,i)).join("");

const edges=ir.edges.map(e=>{const s=pos.get(e.source),t=pos.get(e.target);if(!s||!t)return"";const sx=s.x+s.w/2,sy=s.y+s.h,tx=t.x+t.w/2,ty=t.y;const my2=ty>sy?(sy+ty)/2:sy+24;
const d = ty > sy 
  ? `M${sx},${sy} V${my2} H${tx} V${ty}` 
  : `M${sx},${sy} V${sy+16} H${tx + t.w + 24} V${ty-16} H${tx} V${ty}`;

const lab=e.label?`<rect x="${(sx+tx)/2-4}" y="${my2-16}" width="${Math.max(e.label.length*6+8,20)}" height="14" rx="2" fill="#fff"/><text x="${(sx+tx)/2+(sx===tx?8:0)}" y="${my2-5}" font-size="11" fill="${ink}" text-anchor="${sx===tx?"start":"middle"}">${esc(e.label)}</text>`:"";
return`<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.3"${e.dashed?' stroke-dasharray="6 4"':''} marker-end="url(#a)"/>${lab}`}).join("");

const nodes=[...pos.values()].map(p=>{const x=p.x,y=p.y;const c=colors(p.n,pal);const L=wrap(p.n.label,p.n.shape==="decision"?16:p.n.shape==="database"?20:24);const lh=15;const y0=y+p.h/2-((L.length-1)*lh)/2+4+(p.n.shape==="database"?5:0);
return shape(p.n,x,y,p.w,p.h,c.fill,c.stroke)+`<text font-size="13" fill="${c.text}" text-anchor="middle">${L.map((l,i)=>`<tspan x="${x+p.w/2}" y="${y0+i*lh}">${esc(l)}</tspan>`).join("")}</text>`}).join("");

const watermarkSvg = watermark ? `<text x="${W - 24}" y="${H - 20}" font-size="14" fill="#9ca3af" font-family="Arial, sans-serif" text-anchor="end" opacity="0.8">Generated with MethodFlow</text>` : "";

const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${ff}" role="img" aria-label="${esc(ir.meta.title)}"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ink}"/></marker></defs><rect width="100%" height="100%" fill="${pal.canvas}"/>${groups}${edges}${nodes}${watermarkSvg}</svg>`;
return{svg,w:W,h:H}}
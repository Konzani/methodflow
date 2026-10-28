"use client";
import{create}from"zustand";
import{emptyIR,type E,type IR,type N,type Shape,type Density,type PaletteId,type FlowDirection}from"@/lib/core/ir";
import{layout}from"@/lib/core/layout";
import{migrate}from"@/lib/core/migrate";
export type Sel={k:"n"|"e"|"g";id:string}|null;
interface S{ir:IR;past:IR[];future:IR[];sel:Sel;rev:number;tag:string;t:number;
load:(ir:IR)=>void;commit:(ir:IR,tag?:string)=>void;undo:()=>void;redo:()=>void;select:(s:Sel)=>void;
patchNode:(id:string,p:Partial<N>)=>void;patchEdge:(id:string,p:Partial<E>)=>void;patchTitle:(t:string)=>void;
setPalette:(id:PaletteId)=>void;setDensity:(d:Density)=>void;setFlowDirection:(f:FlowDirection)=>void;
setNodeColor:(id:string,p:{fill?:string;stroke?:string;text?:string})=>void;
setGroupColor:(id:string,color:string|undefined)=>void;
addNode:(s:Shape)=>void;remove:(n:string[],e:string[])=>void;connect:(a:string,b:string)=>void;move:(id:string,x:number,y:number)=>void;relayout:()=>void;
addGroup:(l:string)=>void;removeGroup:(id:string)=>void}
const uid=(p:string)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
export const useDiagram=create<S>((set,get)=>({ir:emptyIR(),past:[],future:[],sel:null,rev:0,tag:"",t:0,
load:ir=>set(s=>({ir:migrate(ir)??ir,past:[],future:[],sel:null,rev:s.rev+1,tag:""})),
commit:(ir,tag="")=>set(s=>{const now=Date.now();const merge=!!tag&&tag===s.tag&&now-s.t<900;return{ir,past:merge?s.past:[...s.past.slice(-49),s.ir],future:[],tag,t:now}}),
undo:()=>set(s=>{const p=s.past[s.past.length-1];return p?{ir:p,past:s.past.slice(0,-1),future:[s.ir,...s.future].slice(0,50),tag:"",sel:null}:s}),
redo:()=>set(s=>{const f=s.future[0];return f?{ir:f,past:[...s.past,s.ir],future:s.future.slice(1),tag:"",sel:null}:s}),
select:sel=>set({sel}),
patchNode:(id,p)=>{const{ir,commit}=get();commit({...ir,nodes:ir.nodes.map(n=>n.id===id?{...n,...p}:n)},"n:"+id+Object.keys(p).join())},
patchEdge:(id,p)=>{const{ir,commit}=get();commit({...ir,edges:ir.edges.map(e=>e.id===id?{...e,...p}:e)},"e:"+id+Object.keys(p).join())},
patchTitle:t=>{const{ir,commit}=get();commit({...ir,meta:{...ir.meta,title:t.slice(0,120)}},"title")},
setPalette:id=>{const{ir,commit}=get();commit({...ir,meta:{...ir.meta,paletteId:id}},"palette")},
setDensity:d=>{const{ir,commit}=get();const next={...ir,meta:{...ir.meta,density:d}};commit(layout(next) as any);set(s=>({rev:s.rev+1}))},
setFlowDirection:f=>{const{ir,commit}=get();const next={...ir,meta:{...ir.meta,flowDirection:f}};commit(layout(next) as any);set(s=>({rev:s.rev+1}))},
setNodeColor:(id,p)=>{const{ir,commit}=get();commit({...ir,nodes:ir.nodes.map(n=>n.id===id?{...n,...p}:n)},"c:"+id)},
// FIX: Run layout on color change to prevent blank screen
setGroupColor:(id,color)=>{const{ir,commit}=get();const next={...ir,groups:ir.groups.map(g=>g.id===id?{...g,color}:g)};commit(layout(next) as any);set(s=>({rev:s.rev+1}))},
addNode:shape=>{const{ir,commit}=get();const id=uid("n");const my=ir.nodes.reduce((m,n)=>Math.max(m,((n as any).y??0)+70),0);const label=shape==="decision"?"Decision?":shape==="terminator"?"End":"New step";commit(layout({...ir,nodes:[...ir.nodes,{id,label,shape,x:ir.nodes[0]?.x??0,y:my}]}) as any);set({sel:{k:"n",id}})},
remove:(ns,es)=>{const{ir,commit}=get();const N=new Set(ns),E=new Set(es);const nodes=ir.nodes.filter(n=>!N.has(n.id));const edges=ir.edges.filter(e=>!E.has(e.id)&&!N.has(e.source)&&!N.has(e.target));if(nodes.length===ir.nodes.length&&edges.length===ir.edges.length)return;commit(layout({...ir,nodes,edges}) as any);set({sel:null})},
connect:(a,b)=>{const{ir,commit}=get();if(a===b||ir.edges.some(e=>e.source===a&&e.target===b))return;const src=ir.nodes.find(n=>n.id===a);const outs=ir.edges.filter(e=>e.source===a).length;const label=src?.shape==="decision"&&outs<2?(outs===0?"Yes":"No"):undefined;commit(layout({...ir,edges:[...ir.edges,{id:uid("e"),source:a,target:b,label}]}) as any)},
move:(id,x,y)=>{const{ir,commit}=get();commit({...ir,nodes:ir.nodes.map(n=>n.id===id?{...n,x,y}:n)})},
relayout:()=>{const{ir,commit}=get();commit(layout(ir) as any);set(s=>({rev:s.rev+1}))},
addGroup:l=>{const{ir,commit}=get();if(ir.groups.length>=8||!l.trim())return;commit(layout({...ir,groups:[...ir.groups,{id:uid("g"),label:l.trim().slice(0,60)}]}) as any)},
removeGroup:id=>{const{ir,commit}=get();commit(layout({...ir,groups:ir.groups.filter(g=>g.id!==id),nodes:ir.nodes.map(n=>n.groupId===id?{...n,groupId:undefined}:n)}) as any)},
}));
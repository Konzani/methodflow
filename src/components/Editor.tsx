"use client";
import{useEffect,useMemo,useRef,useState}from"react";
import Link from"next/link";
import{ReactFlow,Background,Controls,Handle,Position,MarkerType,ReactFlowProvider,useNodesState,useEdgesState,useReactFlow,useStore,type Node,type Edge,type NodeProps}from"@xyflow/react";
import"@xyflow/react/dist/style.css";
import{IRSchema,METHODS,SHAPES,DENSITIES,type Method,type Shape,type Density,type PaletteId,type FlowDirection}from"@/lib/core/ir";
import{placed,size}from"@/lib/core/layout";
import{validateGraph}from"@/lib/core/validate";
import{TEMPLATES,getTemplate}from"@/lib/templates";
import{loadDraft,parseIR,saveDraft}from"@/lib/persist";
import{toSVG,type Theme}from"@/lib/export/svg";
import{DEFAULT_PAGE,loadPageSettings,savePageSettings,type PageSettings}from"@/lib/export/page";
import{PALETTE_LIST,SWATCHES,getPalette}from"@/lib/core/palettes";
import{toMermaid}from"@/lib/export/mermaid";
import{toTikz}from"@/lib/export/tikz";
import{copy,download,slug,toDocx,toPdf,toPng}from"@/lib/export/client";
import{useDiagram}from"@/stores/diagram";

type D={label:string;shape:Shape;fill?:string;stroke?:string;text?:string};
const ML:Record<Method,string>={quantitative:"Quantitative",qualitative:"Qualitative",mixed:"Mixed methods",prisma:"Systematic review (PRISMA)",consort:"Randomised trial (CONSORT)",dsr:"Design science",survey:"Survey",experimental:"Experimental",custom:"Other"};
const SL:Record<Shape,string>={process:"Step",decision:"Decision",terminator:"Start / end",data:"Data",document:"Document",database:"Database"};
const DL:Record<Density,string>={compact:"Compact",balanced:"Balanced",spacious:"Spacious"};
const FL:Record<FlowDirection,string>={auto:"Auto",tb:"Top to bottom",lr:"Left to right"};

function MFNode({data,selected}:NodeProps<Node<D>>){const z=size(data.shape);
const style:React.CSSProperties={width:z.w,height:z.h};
if(data.fill)style.background=data.fill;
if(data.stroke)style.borderColor=data.stroke;
if(data.text)style.color=data.text;
return(
<div className={"mf mf-"+data.shape+(selected?" is-sel":"")} style={style}>
{data.shape==="decision"&&<svg className="mf-dia" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden="true"><polygon points="100,1.5 198.5,48 100,94.5 1.5,48" style={{fill:data.fill,stroke:data.stroke}}/></svg>}
<Handle type="target" position={Position.Top} id="t"/><Handle type="source" position={Position.Bottom} id="b"/>
<Handle type="target" position={Position.Left} id="l"/><Handle type="source" position={Position.Right} id="r"/>
<span className="mf-t">{data.label}</span></div>)}
const nodeTypes={mf:MFNode};

function Modal({title,text,onClose}:{title:string;text:string;onClose:()=>void}){const[c,setC]=useState(false);
useEffect(()=>{const k=(e:KeyboardEvent)=>e.key==="Escape"&&onClose();window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[onClose]);
return(<div className="scrim" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
<h2>{title}</h2><textarea readOnly value={text} rows={12} onFocus={e=>e.currentTarget.select()}/>
<div className="row"><button className="pri" onClick={async()=>{setC(await copy(text));setTimeout(()=>setC(false),1500)}}>{c?"Copied":"Copy"}</button><button onClick={onClose}>Close</button></div></div></div>)}

function Inner(){
const s=useDiagram();const{ir,sel,rev,past,future}=s;const rf=useReactFlow();
const[nodes,setNodes,onNodesChange]=useNodesState<Node<D>>([]);const[edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
const[status,setStatus]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);
const[method,setMethod]=useState<Method>("quantitative");const[text,setText]=useState("");const[extra,setExtra]=useState("");
const[menu,setMenu]=useState(false);const[panel,setPanel]=useState<"l"|"r"|null>(null);
const[code,setCode]=useState<{title:string;text:string}|null>(null);const[grp,setGrp]=useState("");
const[page,setPage]=useState<PageSettings>(DEFAULT_PAGE);
const booted=useRef(false);const irRef=useRef(ir);irRef.current=ir;
const checks=useMemo(()=>validateGraph(ir),[ir]);
const pal=getPalette(ir.meta.paletteId);

const isLand = page.orientation === "landscape";
const pw = isLand ? 297 : 210;
const ph = isLand ? 210 : 297;
const pageW = pw * 3.7795;
const pageH = ph * 3.7795;

const [tx, ty, zoom] = useStore((s) => s.transform);

useEffect(()=>{setPage(loadPageSettings())},[]);
useEffect(()=>{savePageSettings(page)},[page]);
useEffect(()=>{const t=new URLSearchParams(location.search).get("t");const tpl=t?getTemplate(t):undefined;const d=loadDraft();
let start=d??TEMPLATES[0].ir;if(tpl&&(!d||confirm("Replace your saved draft with this template?")))start=tpl.ir;useDiagram.getState().load(placed(start));booted.current=true},[]);
useEffect(()=>{setNodes(ir.nodes.map(n=>({id:n.id,type:"mf",position:{x:n.x??0,y:n.y??0},data:{label:n.label,shape:n.shape,fill:n.fill,stroke:n.stroke,text:n.text},selected:sel?.k==="n"&&sel.id===n.id})))},[ir,sel,setNodes]);
useEffect(()=>{setEdges(ir.edges.map(e=>({id:e.id,source:e.source,target:e.target,label:e.label,type:"smoothstep",selected:sel?.k==="e"&&sel.id===e.id,style:{stroke:pal.ink,strokeWidth:1.4,strokeDasharray:e.dashed?"6 4":undefined},markerEnd:{type:MarkerType.ArrowClosed,color:pal.ink},labelStyle:{fontSize:11,fill:pal.ink},labelBgStyle:{fill:"#fff"}})))},[ir,sel,setEdges,pal.ink]);
useEffect(()=>{const t=setTimeout(()=>rf.fitView({padding:.2,duration:200}),60);return()=>clearTimeout(t)},[rev,rf]);
useEffect(()=>{if(!booted.current)return;const t=setTimeout(()=>setStatus(saveDraft(ir)?"Saved in this browser":"Not saved: browser storage is blocked or full. Export JSON."),800);return()=>clearTimeout(t)},[ir]);
useEffect(()=>{const h=()=>{if(booted.current)saveDraft(irRef.current)};const v=()=>{if(document.visibilityState==="hidden")h()};window.addEventListener("pagehide",h);document.addEventListener("visibilitychange",v);return()=>{window.removeEventListener("pagehide",h);document.removeEventListener("visibilitychange",v)}},[]);
useEffect(()=>{const k=(e:KeyboardEvent)=>{if(/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))return;const m=e.metaKey||e.ctrlKey,c=e.key.toLowerCase(),g=useDiagram.getState();if(m&&c==="z"){e.preventDefault();e.shiftKey?g.redo():g.undo()}else if(m&&c==="y"){e.preventDefault();g.redo()}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[]);

async function gen(){setBusy(true);setMsg("");try{const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({methodology:method,text,extra})});const j=await r.json();if(!r.ok){setMsg(j.message||"Generation failed.");return}const p=IRSchema.safeParse(j.ir);if(!p.success){setMsg("The result was not valid. Your diagram is unchanged.");return}const g=useDiagram.getState();g.commit(placed(p.data));useDiagram.setState(x=>({rev:x.rev+1}));setMsg((j.warnings as string[]|undefined)?.join(" ")||"Draft ready. Check every step against your own method.");setPanel(null)}catch{setMsg("Network error. Your diagram is unchanged.")}finally{setBusy(false)}}
async function exp(k:string){setMenu(false);const d=useDiagram.getState().ir;const n=slug(d.meta.title);setMsg("");try{
if(k==="svg")download(new Blob([toSVG(d,page.theme,page.font).svg],{type:"image/svg+xml"}),n+".svg");
else if(k==="png")download((await toPng(d,page)).blob,n+".png");
else if(k==="pdf")download(await toPdf(d,page),n+".pdf");
else if(k==="docx")download(await toDocx(d,page),n+".docx");
else if(k==="json")download(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}),n+".methodflow.json");
else if(k==="mermaid")setCode({title:"Mermaid",text:toMermaid(d)});
else if(k==="tikz")setCode({title:"LaTeX (TikZ)",text:toTikz(d)})}catch{setMsg("Export failed. Try PNG or SVG.")}}
async function share(){setMenu(false);setMsg("");try{const r=await fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ir:useDiagram.getState().ir})});const j=await r.json();if(!r.ok){setMsg(j.message||"Could not create a link.");return}setCode({title:"Read-only link (kept 90 days)",text:location.origin+"/s/"+j.slug})}catch{setMsg("Network error. No link was created.")}}
async function imp(f?:File){if(!f)return;if(f.size>2e5){setMsg("File is too large.");return}const ir2=parseIR(await f.text());if(!ir2){setMsg("That file is not a MethodFlow JSON diagram.");return}useDiagram.getState().commit(placed(ir2));useDiagram.setState(x=>({rev:x.rev+1}))}

const selNode=sel?.k==="n"?ir.nodes.find(n=>n.id===sel.id):undefined;const selEdge=sel?.k==="e"?ir.edges.find(e=>e.id===sel.id):undefined;

return(<div className="app">
<header className="bar">
<Link href="/" className="brand">MethodFlow</Link>
<input className="title" value={ir.meta.title} maxLength={120} onChange={e=>s.patchTitle(e.target.value)} aria-label="Diagram title"/>
<span className="status" role="status">{status}</span><span className="sp"/>
<button className="m-only" onClick={()=>setPanel(panel==="l"?null:"l")}>Create</button>
<button className="m-only" onClick={()=>setPanel(panel==="r"?null:"r")}>Edit</button>
<button onClick={s.undo} disabled={!past.length} aria-label="Undo">Undo</button>
<button onClick={s.redo} disabled={!future.length} aria-label="Redo">Redo</button>
<button onClick={s.relayout}>Auto-layout</button>
<div className="menu"><button className="pri" aria-expanded={menu} onClick={()=>setMenu(!menu)}>Export</button>
{menu&&<div className="pop" role="menu">
<label className="f">Palette<select value={ir.meta.paletteId??"mono"} onChange={e=>s.setPalette(e.target.value as PaletteId)}>{PALETTE_LIST.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
<label className="f">Density<select value={ir.meta.density??"balanced"} onChange={e=>s.setDensity(e.target.value as Density)}>{DENSITIES.map(d=><option key={d} value={d}>{DL[d]}</option>)}</select></label>
<label className="f">Flow<select value={ir.meta.flowDirection??"auto"} onChange={e=>s.setFlowDirection(e.target.value as FlowDirection)}>{(Object.keys(FL) as FlowDirection[]).map(f=><option key={f} value={f}>{FL[f]}</option>)}</select></label>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
<label className="f">Page<select value={page.size} onChange={e=>setPage({...page,size:e.target.value as PageSettings["size"]})}><option value="a4">A4</option><option value="a5">A5</option><option value="a3">A3</option><option value="letter">Letter</option><option value="legal">Legal</option></select></label>
<label className="f">Orientation<select value={page.orientation} onChange={e=>setPage({...page,orientation:e.target.value as PageSettings["orientation"]})}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
<label className="f">Margin mm<input type="number" min={5} max={40} value={page.margin} onChange={e=>setPage({...page,margin:Math.max(5,Math.min(40,Number(e.target.value)||20))})}/></label>
<label className="f">Font<select value={page.font} onChange={e=>setPage({...page,font:e.target.value as PageSettings["font"]})}><option value="sans">Sans</option><option value="serif">Serif</option></select></label>
</div>
{[["png","PNG image"],["svg","SVG vector"],["pdf","PDF"],["docx","Word (.docx) with caption"],["mermaid","Mermaid code"],["tikz","LaTeX TikZ code"],["json","JSON (re-importable)"]].map(([k,l])=><button key={k} role="menuitem" onClick={()=>exp(k)}>{l}</button>)}
<hr/><button role="menuitem" onClick={share}>Create read-only link</button></div>}</div>
</header>

<aside className="side left" data-open={panel==="l"}>
<h2>Generate from your method</h2>
<label className="f">Research design<select value={method} onChange={e=>setMethod(e.target.value as Method)}>{METHODS.map(m=><option key={m} value={m}>{ML[m]}</option>)}</select></label>
<label className="f">Key details<input value={extra} maxLength={300} onChange={e=>setExtra(e.target.value)} placeholder="Sample, instruments, analysis"/></label>
<label className="f">Methodology text<textarea value={text} maxLength={8000} rows={6} onChange={e=>setText(e.target.value)} placeholder="Paste your methodology paragraph. Leave empty to use the standard stages."/></label>
<button className="pri wide" onClick={gen} disabled={busy}>{busy?"Generating…":"Generate flowchart"}</button>
{msg&&<p className="note" role="status">{msg}</p>}
<h2>Templates</h2>
<ul className="list">{TEMPLATES.map(t=><li key={t.slug}><button onClick={()=>{useDiagram.getState().commit(t.ir);useDiagram.setState(x=>({rev:x.rev+1}));setPanel(null)}}>{t.title.replace(/ flowchart| flow diagram| template/gi,"")}</button></li>)}</ul>
<h2>Add shape</h2>
<div className="grid">{SHAPES.map(sh=><button key={sh} onClick={()=>s.addNode(sh)}>{SL[sh]}</button>)}</div>
<h2>File</h2>
<label className="file">Import JSON<input type="file" accept="application/json,.json" onChange={e=>{imp(e.target.files?.[0]);e.target.value=""}}/></label>
</aside>

<main className="canvas" aria-label="Diagram canvas">
<ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
onConnect={c=>c.source&&c.target&&s.connect(c.source,c.target)} onNodeClick={(_,n)=>s.select({k:"n",id:n.id})} onEdgeClick={(_,e)=>s.select({k:"e",id:e.id})} onPaneClick={()=>s.select(null)}
onNodeDragStop={(_,n)=>s.move(n.id,Math.round(n.position.x),Math.round(n.position.y))}
onNodesDelete={d=>s.remove(d.map(n=>n.id),[])} onEdgesDelete={d=>s.remove([],d.map(e=>e.id))}
deleteKeyCode={["Backspace","Delete"]} snapToGrid snapGrid={[8,8]} minZoom={.2} maxZoom={2} fitView>
<div style={{
  position: "absolute",
  top: 0, left: 0,
  transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
  transformOrigin: "0 0",
  pointerEvents: "none",
  zIndex: -1
}}>
  <svg width={pageW} height={pageH} style={{ overflow: "visible" }}>
    <rect width="100%" height="100%" fill="#fff" stroke="#d1d5db" strokeWidth={2} style={{ filter: "drop-shadow(0px 4px 12px rgba(0,0,0,0.05))" }} />
    <text x={pageW/2} y={-20} textAnchor="middle" fontSize={18} fill="#9ca3af" fontWeight="bold">
      {page.size.toUpperCase()} {page.orientation.toUpperCase()} ({pw}×{ph}mm)
    </text>
  </svg>
</div>
<Background gap={24} size={1} color="#D9DEE3"/><Controls showInteractive={false}/></ReactFlow>
</main>

<aside className="side right" data-open={panel==="r"}>
{selNode?<>
<h2>Step</h2>
<label className="f">Label<input value={selNode.label} maxLength={80} onChange={e=>s.patchNode(selNode.id,{label:e.target.value||" "})}/></label>
<label className="f">Shape<select value={selNode.shape} onChange={e=>s.patchNode(selNode.id,{shape:e.target.value as Shape})}>{SHAPES.map(sh=><option key={sh} value={sh}>{SL[sh]}</option>)}</select></label>
<label className="f">Phase<select value={selNode.groupId??""} onChange={e=>s.patchNode(selNode.id,{groupId:e.target.value||undefined})}><option value="">None</option>{ir.groups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
<h3 style={{fontSize:13,margin:"8px 0 4px"}}>Colour</h3>
<div className="swatches">{SWATCHES.map((sw,i)=><button key={i} title={sw.name} className="sw" style={{background:sw.fill||"#fff",borderColor:sw.stroke||"#ccc"}} onClick={()=>s.setNodeColor(selNode.id,sw.fill?{fill:sw.fill,stroke:sw.stroke}:{fill:undefined,stroke:undefined})}/>)}</div>
<label className="f">Notes<textarea rows={3} maxLength={300} value={selNode.notes??""} onChange={e=>s.patchNode(selNode.id,{notes:e.target.value||undefined})}/></label>
<button className="danger" onClick={()=>s.remove([selNode.id],[])}>Delete step</button></>
:selEdge?<>
<h2>Connector</h2>
<label className="f">Label<input value={selEdge.label??""} maxLength={40} onChange={e=>s.patchEdge(selEdge.id,{label:e.target.value||undefined})} placeholder="Yes / No"/></label>
<label className="chk"><input type="checkbox" checked={!!selEdge.dashed} onChange={e=>s.patchEdge(selEdge.id,{dashed:e.target.checked||undefined})}/>Dashed line</label>
<button className="danger" onClick={()=>s.remove([],[selEdge.id])}>Delete connector</button></>
:<>
<h2>Phases</h2>
<ul className="list">{ir.groups.map((g,i)=><li key={g.id} className="split"><span>{g.label}</span><span className="row" style={{gap:4}}>
<input type="color" value={g.color??pal.groupTints[i%pal.groupTints.length]} onChange={e=>s.setGroupColor(g.id,e.target.value)} title="Phase colour" className="col"/>
<button onClick={()=>s.removeGroup(g.id)} aria-label={"Remove "+g.label}>×</button></span></li>)}</ul>
<form className="row" onSubmit={e=>{e.preventDefault();s.addGroup(grp);setGrp("")}}><input value={grp} maxLength={60} onChange={e=>setGrp(e.target.value)} placeholder="New phase" aria-label="New phase name"/><button type="submit">Add</button></form>
<h2>Palette</h2>
<select value={ir.meta.paletteId??"mono"} onChange={e=>s.setPalette(e.target.value as PaletteId)} style={{width:"100%",border:"1px solid var(--line)",borderRadius:"var(--r)",padding:"7px 8px",background:"#fff"}}>{PALETTE_LIST.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
<h2>Checks</h2>
{checks.length?<ul className="checks">{checks.map(c=><li key={c}>{c}</li>)}</ul>:<p className="note">No structural problems found.</p>}
<p className="note">Click a step or connector to edit it. Drag from a handle to connect. Delete removes the selection.</p></>}
</aside>
{code&&<Modal title={code.title} text={code.text} onClose={()=>setCode(null)}/>}
</div>)}

export default function Editor(){return<ReactFlowProvider><Inner/></ReactFlowProvider>}
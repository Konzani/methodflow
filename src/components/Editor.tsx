"use client";
import{useEffect,useMemo,useRef,useState}from"react";
import Link from"next/link";
import{ReactFlow,Background,Controls,Handle,Position,MarkerType,ReactFlowProvider,useNodesState,useEdgesState,useReactFlow,ViewportPortal,type Node,type Edge,type NodeProps}from"@xyflow/react";
import"@xyflow/react/dist/style.css";
import{IRSchema,METHODS,SHAPES,DENSITIES,type Method,type Shape,type Density,type PaletteId,type FlowDirection}from"@/lib/core/ir";
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
import{useUpgradeStore}from"@/stores/upgrade";
import{UpgradeModal}from"@/components/UpgradeModal";
import{createClient}from"@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type D={label:string;shape:Shape;fill?:string;stroke?:string;text?:string;w?:number;h?:number};
const ML:Record<Method,string>={quantitative:"Quantitative",qualitative:"Qualitative",mixed:"Mixed methods",prisma:"Systematic review (PRISMA)",consort:"Randomised trial (CONSORT)",dsr:"Design science",survey:"Survey",experimental:"Experimental",custom:"Other"};
const SL:Record<Shape,string>={process:"Step",decision:"Decision",terminator:"Start / end",data:"Data",document:"Document",database:"Database"};
const DL:Record<Density,string>={compact:"Compact",balanced:"Balanced",spacious:"Spacious"};

function MFNode({data,selected}:NodeProps<Node<D>>){
  const w = data.w || 200;
  const h = data.h || 70;
  
  const style = {
    width: w, 
    height: h,
    "--node-fill": data.fill || "#fff",
    "--node-stroke": data.stroke || "var(--ink)"
  } as React.CSSProperties;

  return(
  <div className={"mf mf-"+data.shape+(selected?" is-sel":"")} style={style}>
  {data.shape==="decision"&&<svg className="mf-dia" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden="true"><polygon points="100,1.5 198.5,48 100,94.5 1.5,48" style={{fill:"var(--node-fill)", stroke:"var(--node-stroke)"}}/></svg>}
  <Handle type="target" position={Position.Top} id="t"/><Handle type="source" position={Position.Bottom} id="b"/>
  <Handle type="target" position={Position.Left} id="l"/><Handle type="source" position={Position.Right} id="r"/>
  <span className="mf-t" style={{color: data.text || "var(--ink)"}}>{data.label}</span></div>)}
const nodeTypes={mf:MFNode};

function Modal({title,text,onClose}:{title:string;text:string;onClose:()=>void}){const[c,setC]=useState(false);
useEffect(()=>{const k=(e:KeyboardEvent)=>e.key==="Escape"&&onClose();window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[onClose]);
return(<div className="scrim" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}>
<h2>{title}</h2><textarea readOnly value={text} rows={12} onFocus={e=>e.currentTarget.select()}/>
<div className="row"><button className="pri" onClick={async()=>{setC(await copy(text));setTimeout(()=>setC(false),1500)}}>{c?"Copied":"Copy"}</button><button onClick={onClose}>Close</button></div></div></div>)}

function Inner(){
const s=useDiagram();const{ir,sel,rev,past,future}=s;const rf=useReactFlow();
const router = useRouter();
const openUpgrade = useUpgradeStore(state => state.open);
const[nodes,setNodes,onNodesChange]=useNodesState<Node<D>>([]);const[edges,setEdges,onEdgesChange]=useEdgesState<Edge>([]);
const[status,setStatus]=useState("");const[msg,setMsg]=useState("");const[busy,setBusy]=useState(false);
const[method,setMethod]=useState<Method>("quantitative");const[text,setText]=useState("");const[extra,setExtra]=useState("");
const[refineText,setRefineText]=useState("");
const[uploadedFile,setUploadedFile]=useState<string|null>(null);
const[showGuide,setShowGuide]=useState(true);
const[showPromptGuide,setShowPromptGuide]=useState(false);
const[menu,setMenu]=useState(false);const[panel,setPanel]=useState<"l"|"r"|null>(null);
const[code,setCode]=useState<{title:string;text:string}|null>(null);const[grp,setGrp]=useState("");
const[page,setPage]=useState<PageSettings>(DEFAULT_PAGE);
const[cloudId,setCloudId]=useState<string|null>(null);
const[user,setUser]=useState<User|null>(null);
const[plan,setPlan]=useState<"free"|"pro">("free");

const booted=useRef(false);const irRef=useRef(ir);irRef.current=ir;
const checks=useMemo(()=>validateGraph(ir),[ir]);
const pal=getPalette(ir.meta.paletteId);

const isLand = page.orientation === "landscape";
const pw = isLand ? 297 : 210;
const ph = isLand ? 210 : 297;
const pageW = pw * 3.7795;
const pageH = ph * 3.7795;

const groupBoxes = useMemo(() => {
  return ir.groups.map((g: any, i) => {
    if (typeof g.x !== "number") return null;
    const tint = g.color ?? pal.groupTints[i % pal.groupTints.length];
    return (
      <div key={g.id} style={{
        position: 'absolute',
        transform: `translate(${g.x}px, ${g.y}px)`,
        width: g.w, height: g.h,
        backgroundColor: tint,
        border: `1px solid ${pal.accent}22`,
        borderRadius: 8, zIndex: -1, pointerEvents: 'none'
      }}>
        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: pal.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {g.label}
        </div>
      </div>
    );
  });
}, [ir.groups, pal]);

useEffect(()=>{
  const supabase = createClient();
  
  const fetchUserAndPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      if (profile) setPlan(profile.plan as "free" | "pro");
    }
  };
  
  fetchUserAndPlan();

  const {data: authListener} = supabase.auth.onAuthStateChange((_, session) => {
    setUser(session?.user ?? null);
    if (session?.user) {
      supabase.from("profiles").select("plan").eq("id", session.user.id).single().then(({data}) => {
        if (data) setPlan(data.plan as "free" | "pro");
      });
    } else {
      setPlan("free");
    }
  });
  return () => authListener.subscription.unsubscribe();
},[]);

useEffect(()=>{setPage(loadPageSettings())},[]);
useEffect(()=>{savePageSettings(page)},[page]);
useEffect(()=>{
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const t = params.get("t");
  
  const init = async () => {
    if (id) {
      const supabase = createClient();
      const { data, error } = await supabase.from("diagrams").select("ir").eq("id", id).single();
      if (!error && data?.ir) {
        setCloudId(id);
        useDiagram.getState().load(data.ir);
        booted.current = true;
        return;
      }
    }
    
    const tpl = t ? getTemplate(t) : undefined;
    const d = loadDraft();
    let start = d ?? TEMPLATES[0].ir;
    if (tpl && (!d || confirm("Replace your saved draft with this template?"))) start = tpl.ir;
    useDiagram.getState().load(start);
    booted.current = true;
  };
  
  init();
},[]);

useEffect(()=>{
  setNodes(ir.nodes.map(n=>{
    const anyNode = n as any;
    return {
      id:n.id,
      type:"mf",
      position:{x:anyNode.x??0, y:anyNode.y??0},
      data: {
        label: n.label,
        shape: n.shape,
        fill: n.fill,
        stroke: n.stroke,
        text: n.text,
        w: anyNode.w,
        h: anyNode.h
      },
      selected: sel?.k==="n" && sel.id===n.id
    };
  }));
},[ir,sel,setNodes]);

useEffect(()=>{setEdges(ir.edges.map(e=>({id:e.id,source:e.source,target:e.target,label:e.label,type:"smoothstep",selected:sel?.k==="e"&&sel.id===e.id,style:{stroke:pal.ink,strokeWidth:1.4,strokeDasharray:e.dashed?"6 4":undefined},markerEnd:{type:MarkerType.ArrowClosed,color:pal.ink},labelStyle:{fontSize:11,fill:pal.ink},labelBgStyle:{fill:"#fff"}})))},[ir,sel,setEdges,pal.ink]);
useEffect(()=>{const t=setTimeout(()=>rf.fitView({padding:.2,duration:200}),60);return()=>clearTimeout(t)},[rev,rf]);
useEffect(()=>{if(!booted.current)return;const t=setTimeout(()=>setStatus(saveDraft(ir)?"Saved in this browser":"Not saved: browser storage is blocked or full. Export JSON."),800);return()=>clearTimeout(t)},[ir]);
useEffect(()=>{const h=()=>{if(booted.current)saveDraft(irRef.current)};const v=()=>{if(document.visibilityState==="hidden")h()};window.addEventListener("pagehide",h);document.addEventListener("visibilitychange",v);return()=>{window.removeEventListener("pagehide",h);document.removeEventListener("visibilitychange",v)}},[]);
useEffect(()=>{const k=(e:KeyboardEvent)=>{if(/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))return;const m=e.metaKey||e.ctrlKey,c=e.key.toLowerCase(),g=useDiagram.getState();if(m&&c==="z"){e.preventDefault();e.shiftKey?g.redo():g.undo()}else if(m&&c==="y"){e.preventDefault();g.redo()}};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k)},[]);

function loadExample(){
  setMethod("quantitative");
  setText("A cross-sectional survey was conducted with 250 postgraduate students recruited through stratified random sampling. Data were collected using a validated 45-item online questionnaire. Ethical approval was obtained from the institutional review board prior to data collection. Instrument reliability was confirmed with a Cronbach's alpha of 0.89. Responses were analyzed using descriptive statistics, Pearson correlation, and hierarchical multiple regression in SPSS.");
  setMsg("Example methodology loaded. Click 'Generate flowchart' to see the result.");
}

async function handleSignOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.push("/");
  router.refresh();
}

async function saveCloud() {
  if (!user) {
    setMsg("Please sign in to save to the cloud.");
    window.location.href = "/login";
    return;
  }

  if (plan === "free") {
    openUpgrade("feature");
    return;
  }

  setBusy(true); setMsg("Saving to cloud...");
  try {
    const supabase = createClient();
    const d = useDiagram.getState().ir;
    
    if (cloudId) {
      const { error } = await supabase.from("diagrams").update({ ir: d, title: d.meta.title, updated_at: new Date().toISOString() }).eq("id", cloudId);
      if (error) throw error;
      setMsg("Saved to cloud.");
    } else {
      const { data, error } = await supabase.from("diagrams").insert({ user_id: user.id, ir: d, title: d.meta.title }).select("id").single();
      if (error) throw error;
      
      setCloudId(data.id);
      window.history.replaceState(null, '', `?id=${data.id}`);
      setMsg("Saved to cloud.");
    }
  } catch (e: any) {
    setMsg(e.message || "Failed to save to cloud.");
  } finally {
    setBusy(false);
  }
}

async function gen(){
  setBusy(true);setMsg("");
  try{
    const r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({methodology:method,text,extra})});
    const j=await r.json();
    
    if(r.status === 429){
      setMsg("");
      openUpgrade("limit");
      return;
    }
    
    if(!r.ok){setMsg(j.message||"Generation failed.");return}
    const p=IRSchema.safeParse(j.ir);
    if(!p.success){setMsg("The result was not valid. Your diagram is unchanged.");return}
    const g=useDiagram.getState();g.commit(p.data);
    useDiagram.setState(x=>({rev:x.rev+1}));
    setMsg((j.warnings as string[]|undefined)?.join(" ")||"Draft ready. Check every step against your own method.");
    setPanel(null)
  }catch{setMsg("Network error. Your diagram is unchanged.")}finally{setBusy(false)}
}

async function upload(file?: File) {
  if (!file) return;
  if (plan === "free") {
    openUpgrade("feature");
    return;
  }
  setUploadedFile(file.name);
  setBusy(true); 
  setMsg(`Extracting text from ${file.name}...`);
  
  try {
    const formData = new FormData();
    formData.append("file", file);

    const r = await fetch("/api/upload", { method: "POST", body: formData });
    
    const rawText = await r.text();
    let j: any;
    try {
      j = JSON.parse(rawText);
    } catch {
      if (!r.ok) throw new Error(`Server Error: ${r.status} ${r.statusText}`);
      throw new Error("Invalid response from server");
    }

    if (!r.ok) {
      setMsg(j.message || "Upload failed.");
      return;
    }

    const p = IRSchema.safeParse(j.ir);
    if (!p.success) {
      setMsg("The result was not valid.");
      return;
    }

    const g = useDiagram.getState();
    g.commit(p.data);
    useDiagram.setState(x => ({ rev: x.rev + 1 }));
    setMsg("Draft ready from uploaded document.");
    setPanel(null);
  } catch (err: any) {
    setMsg(err.message || "Network error during upload.");
  } finally {
    setBusy(false);
    setUploadedFile(null);
  }
}

async function doRefine(){
  if(!refineText.trim())return;
  setBusy(true);setMsg("");
  try{
    const r=await fetch("/api/refine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ir:useDiagram.getState().ir,instruction:refineText})});
    const j=await r.json();
    
    if(r.status === 429){
      setMsg("");
      openUpgrade("limit");
      return;
    }
    
    if(!r.ok){setMsg(j.message||"Refine failed.");return}
    const p=IRSchema.safeParse(j.ir);
    if(!p.success){setMsg("The result was not valid. Your diagram is unchanged.");return}
    const g=useDiagram.getState();
    g.commit(p.data);
    useDiagram.setState(x=>({rev:x.rev+1}));
    setMsg("Refined successfully.");
    setRefineText("");
    setPanel(null);
  }catch{setMsg("Network error. Your diagram is unchanged.")}finally{setBusy(false)}
}

async function exp(k:string){
  if ((k === "docx" || k === "tikz") && plan === "free") {
    setMenu(false);
    openUpgrade("feature");
    return;
  }
  
  setMenu(false);
  const d=useDiagram.getState().ir;
  const n=slug(d.meta.title);
  setMsg("");
  
  try{
    if(k==="svg"){
      download(new Blob([toSVG(d,page.theme,page.font,undefined,plan==="free").svg],{type:"image/svg+xml"}),n+".svg");
      if(plan==="free") setTimeout(()=>openUpgrade("watermark"), 800);
    }
    else if(k==="png"){
      download((await toPng(d,page,plan==="free")).blob,n+".png");
      if(plan==="free") setTimeout(()=>openUpgrade("watermark"), 800);
    }
    else if(k==="pdf"){
      download(await toPdf(d,page,plan==="free"),n+".pdf");
      if(plan==="free") setTimeout(()=>openUpgrade("watermark"), 800);
    }
    else if(k==="docx") download(await toDocx(d,page,plan==="free"),n+".docx");
    else if(k==="json") download(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}),n+".methodflow.json");
    else if(k==="mermaid") setCode({title:"Mermaid",text:toMermaid(d)});
    else if(k==="tikz") setCode({title:"LaTeX (TikZ)",text:toTikz(d)})
  }catch{setMsg("Export failed. Try PNG or SVG.")}
}
async function share(){setMenu(false);setMsg("");try{const r=await fetch("/api/share",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ir:useDiagram.getState().ir})});const j=await r.json();if(!r.ok){setMsg(j.message||"Could not create a link.");return}setCode({title:"Read-only link (kept 90 days)",text:location.origin+"/s/"+j.slug})}catch{setMsg("Network error. No link was created.")}}
async function imp(f?:File){if(!f)return;if(f.size>2e5){setMsg("File is too large.");return}const ir2=parseIR(await f.text());if(!ir2){setMsg("That file is not a MethodFlow JSON diagram.");return}useDiagram.getState().commit(ir2);useDiagram.setState(x=>({rev:x.rev+1}))}

const selNode=sel?.k==="n"?ir.nodes.find(n=>n.id===sel.id):undefined;const selEdge=sel?.k==="e"?ir.edges.find(e=>e.id===sel.id):undefined;

return(<div className="app">
<header className="bar">
<Link href="/" className="brand">MethodFlow</Link>
<input className="title" value={ir.meta.title} maxLength={120} onChange={e=>s.patchTitle(e.target.value)} aria-label="Diagram title"/>
<span className="status" role="status">{status}</span><span className="sp"/>
<button className="m-only" onClick={()=>setPanel(panel==="l"?null:"l")}>Create</button>
<button className="m-only" onClick={()=>setPanel(panel==="r"?null:"r")}>Edit</button>
<button onClick={saveCloud} disabled={busy} style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>Save to Cloud</button>
<button onClick={s.undo} disabled={!past.length} aria-label="Undo">Undo</button>
<button onClick={s.redo} disabled={!future.length} aria-label="Redo">Redo</button>
<button onClick={s.relayout}>Auto-layout</button>
<button onClick={()=>setShowGuide(!showGuide)}>
  {showGuide ? "Hide A4" : "Show A4"}
</button>

{user ? (
  <div className="row" style={{ alignItems: "center", gap: 8, marginLeft: 8 }}>
    <Link href="/dashboard" className="btn ghost" style={{ padding: "5px 10px", fontSize: 13, textDecoration: "none" }} title={user.email}>
      My Dashboard
    </Link>
    <button onClick={handleSignOut} style={{ fontSize: 13, padding: "5px 10px" }}>Sign out</button>
  </div>
) : (
  <Link href="/login" className="btn ghost" style={{ padding: "5px 10px", fontSize: 14, marginLeft: 8, textDecoration: "none" }}>Sign in</Link>
)}

<div className="menu">
  <button className="pri" aria-expanded={menu} onClick={()=>setMenu(!menu)}>Export</button>
  {menu && <div className="pop" role="menu">
    {[["png","PNG image"],["svg","SVG vector"],["pdf","PDF"],["docx","Word (.docx) with caption"],["mermaid","Mermaid code"],["tikz","LaTeX TikZ code"],["json","JSON (re-importable)"]].map(([k,l])=><button key={k} role="menuitem" onClick={()=>exp(k)}>{l}</button>)}
    <hr/>
    <button role="menuitem" onClick={share}>Create read-only link</button>
  </div>}
</div>
</header>

<aside className="side left" data-open={panel==="l"}>
<h2>Generate from your method</h2>
<label className="f">Research design<select value={method} onChange={e=>setMethod(e.target.value as Method)}>{METHODS.map(m=><option key={m} value={m}>{ML[m]}</option>)}</select></label>
<label className="f">Key details<input value={extra} maxLength={300} onChange={e=>setExtra(e.target.value)} placeholder="Sample, instruments, analysis"/></label>
<label className="f">Methodology text
  <textarea 
    value={text} 
    maxLength={8000} 
    rows={10} 
    onChange={e=>setText(e.target.value)} 
    placeholder="e.g., A cross-sectional survey of 250 students using stratified random sampling. Data collected via a 40-item questionnaire and analyzed using multiple regression in SPSS."
    style={{ resize: "vertical", minHeight: 180 }}
  />
</label>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -4, marginBottom: 8 }}>
  <button className="note" style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }} onClick={loadExample}>
    Try an example
  </button>
  <button className="note" style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }} onClick={() => setShowPromptGuide(true)}>
    How to write a great prompt
  </button>
</div>
<button className="pri wide" onClick={gen} disabled={busy}>{busy?"Generating…":"Generate flowchart"}</button>

<div style={{ marginTop: 8, marginBottom: 24, textAlign: "center" }}>
  <label style={{ 
    display: "inline-flex", alignItems: "center", justifyContent: "center", 
    padding: "6px 12px", border: "1px solid var(--line)", borderRadius: "var(--r)", 
    cursor: busy ? "wait" : "pointer", fontSize: 13, color: "var(--graphite)",
    background: "transparent", transition: "all 0.2s"
  }}>
    <span style={{ fontWeight: 500 }}>
      {busy && uploadedFile ? `Processing ${uploadedFile}...` : "Or upload a PDF / DOCX"}
    </span>
    <input 
      type="file" 
      accept=".pdf,.docx,.txt" 
      onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} 
      disabled={busy}
      style={{ display: "none" }}
    />
  </label>
  <p className="note" style={{ marginTop: 8, fontSize: 11 }}>
    <strong>Pro tip:</strong> Include sample size, instruments, and analysis methods in your text for the most accurate diagram.
  </p>
</div>

<h2 style={{marginTop:16}}>Refine with AI</h2>
<label className="f">Instruction
  <input value={refineText} maxLength={500} onChange={e=>setRefineText(e.target.value)} placeholder="e.g., Add a decision gate for missing data"/>
</label>
<button className="wide" onClick={doRefine} disabled={busy || !refineText.trim()}>
  {busy ? "Refining…" : "Apply Edit"}
</button>

{msg&&<p className="note" role="status" style={{marginTop:8}}>{msg}</p>}
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
<ViewportPortal>
  {showGuide && (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: -2 }}>
        <svg width={pageW} height={pageH} style={{ overflow: "visible" }}>
          <rect width="100%" height="100%" fill="#fff" stroke="#d1d5db" strokeWidth={2} style={{ filter: "drop-shadow(0px 4px 12px rgba(0,0,0,0.05))" }} />
          <text x={pageW/2} y={-20} textAnchor="middle" fontSize={18} fill="#9ca3af" fontWeight="bold">
            {page.size.toUpperCase()} {page.orientation.toUpperCase()} ({pw}×{ph}mm)
          </text>
        </svg>
    </div>
  )}
  {groupBoxes}
</ViewportPortal>
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
<h2>Diagram Style</h2>
<label className="f">Palette<select value={ir.meta.paletteId??"mono"} onChange={e=>s.setPalette(e.target.value as PaletteId)}>{PALETTE_LIST.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
<label className="f">Density<select value={ir.meta.density??"balanced"} onChange={e=>s.setDensity(e.target.value as Density)}>{DENSITIES.map(d=><option key={d} value={d}>{DL[d]}</option>)}</select></label>
<label className="f">Flow
  <select value={ir.meta.flowDirection??"auto"} onChange={e=>s.setFlowDirection(e.target.value as FlowDirection)}>
    <option value="tb">Top to bottom</option>
    <option value="lr">Left to right</option>
  </select>
</label>

<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
<label className="f">Page<select value={page.size} onChange={e=>setPage({...page,size:e.target.value as PageSettings["size"]})}><option value="a4">A4</option><option value="a5">A5</option><option value="a3">A3</option><option value="letter">Letter</option><option value="legal">Legal</option></select></label>
<label className="f">Orientation<select value={page.orientation} onChange={e=>setPage({...page,orientation:e.target.value as PageSettings["orientation"]})}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
<label className="f">Margin mm<input type="number" min={5} max={40} value={page.margin} onChange={e=>setPage({...page,margin:Math.max(5,Math.min(40,Number(e.target.value)||20))})}/></label>
<label className="f">Font<select value={page.font} onChange={e=>setPage({...page,font:e.target.value as PageSettings["font"]})}><option value="sans">Sans</option><option value="serif">Serif</option></select></label>
</div>

<h2 style={{marginTop:16}}>Phases</h2>
<ul className="list">{ir.groups.map((g,i)=><li key={g.id} className="split"><span>{g.label}</span><span className="row" style={{gap:4}}>
<input type="color" value={g.color??pal.groupTints[i%pal.groupTints.length]} onChange={e=>s.setGroupColor(g.id,e.target.value)} title="Phase colour" className="col"/>
<button onClick={()=>s.removeGroup(g.id)} aria-label={"Remove "+g.label}>×</button></span></li>)}</ul>
<form className="row" onSubmit={e=>{e.preventDefault();s.addGroup(grp);setGrp("")}}><input value={grp} maxLength={60} onChange={e=>setGrp(e.target.value)} placeholder="New phase" aria-label="New phase name"/><button type="submit">Add</button></form>

<h2>Checks</h2>
{checks.length?<ul className="checks">{checks.map(c=><li key={c}>{c}</li>)}</ul>:<p className="note">No structural problems found.</p>}
<p className="note">Click a step or connector to edit it. Drag from a handle to connect. Delete removes the selection.</p></>}
</aside>
{code&&<Modal title={code.title} text={code.text} onClose={()=>setCode(null)}/>}

{showPromptGuide && (
  <div className="scrim" onClick={() => setShowPromptGuide(false)} style={{ zIndex: 100 }}>
    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
      <h2 style={{ fontSize: 24, marginBottom: 8 }}>How to write a perfect prompt</h2>
      <p style={{ color: "var(--graphite)", fontSize: 15, marginBottom: 24 }}>
        The AI is only as good as the text you give it. To get a thesis-ready diagram, include these 4 elements in your text:
      </p>
      
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>1. The Design & Sample</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
            Mention the exact design and sample size.<br/>
            <em style={{ color: "var(--accent)" }}>e.g., "A cross-sectional survey of 250 students using stratified random sampling..."</em>
          </p>
        </div>
        
        <div>
          <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>2. The Instruments</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
            Specify how data was collected.<br/>
            <em style={{ color: "var(--accent)" }}>e.g., "...using a validated 40-item online questionnaire."</em>
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>3. The Analysis</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
            Name the statistical tests or qualitative methods.<br/>
            <em style={{ color: "var(--accent)" }}>e.g., "...analyzed using hierarchical multiple regression in SPSS."</em>
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>4. Decision Gates (If applicable)</h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
            Mention any checks, validity tests, or "if/then" scenarios.<br/>
            <em style={{ color: "var(--accent)" }}>e.g., "If the reliability alpha was below 0.7, the questionnaire was revised."</em>
          </p>
        </div>
      </div>

      <div style={{ background: "var(--wash)", padding: 16, borderRadius: "var(--r)", marginTop: 24 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          Pro Tip: Use the PDF Upload
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--graphite)" }}>
          If you already have a written methodology chapter, just click <strong>"Or upload a PDF / DOCX"</strong> below. The AI will automatically extract the methodology and build the flowchart for you.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Link href="/guide" target="_blank" className="note" style={{ textDecoration: "underline", alignSelf: "center" }}>Read the full guide →</Link>
        <button className="pri" onClick={() => setShowPromptGuide(false)} style={{ marginLeft: "auto" }}>Got it</button>
      </div>
    </div>
  </div>
)}

<UpgradeModal />
</div>)}

export default function Editor(){return<ReactFlowProvider><Inner/></ReactFlowProvider>}
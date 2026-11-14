"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  ViewportPortal,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  IRSchema,
  REQUEST_METHODS,
  SHAPES,
  DENSITIES,
  type IR,
  type Method,
  type RequestMethod,
  type Shape,
  type Density,
  type PaletteId,
  type FlowDirection,
} from "@/lib/core/ir";
import { validateGraph } from "@/lib/core/validate";
import { layout } from "@/lib/core/layout";
import { bestPrintPlan, printInfo } from "@/lib/export/print";
import { withStyle } from "@/lib/core/style";
import { TEMPLATES, getTemplate } from "@/lib/templates";
import { clearDraft, loadDraft, parseIR, saveDraft } from "@/lib/persist";
import { toSVG, type Theme } from "@/lib/export/svg";
import { contentBoxes, DEFAULT_PAGE, loadPageSettings, resolvePage, savePageSettings, type PageSettings } from "@/lib/export/page";
import { PALETTE_LIST, SWATCHES, getPalette } from "@/lib/core/palettes";
import { toMermaid } from "@/lib/export/mermaid";
import { toTikz } from "@/lib/export/tikz";
import { copy, download, slug, toDocx, toPdf, toPng } from "@/lib/export/client";
import { useDiagram } from "@/stores/diagram";
import { classifyFailure, friendlyGenerationError, generationErrorHint, type GenErrorCode } from "@/lib/gen-errors";
import { useUpgradeStore } from "@/stores/upgrade";
import { UpgradeModal } from "@/components/UpgradeModal";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type D = { label: string; shape: Shape; fill?: string; stroke?: string; text?: string; w?: number; h?: number };
const ML: Record<Method, string> = {
  quantitative: "Quantitative",
  qualitative: "Qualitative",
  mixed: "Mixed methods",
  prisma: "Systematic review (PRISMA)",
  consort: "Randomised trial (CONSORT)",
  dsr: "Design science",
  survey: "Survey",
  experimental: "Experimental",
  custom: "Other",
};
const RL: Record<RequestMethod, string> = { auto: "Auto-detect (recommended)", ...ML };
const SL: Record<Shape, string> = {
  process: "Step",
  decision: "Decision",
  terminator: "Start / end",
  data: "Data",
  document: "Document",
  database: "Database",
};
const DL: Record<Density, string> = { compact: "Compact", balanced: "Balanced", spacious: "Spacious" };
const FL = { auto: "Auto (fit page)", tb: "Top to bottom", lr: "Left to right", branches: "Branch columns" };

const GEN_STAGES = [
  { at: 0, msg: "Reading your methodology…" },
  { at: 1500, msg: "Identifying the research design…" },
  { at: 3500, msg: "Structuring phases and decision gates…" },
  { at: 6000, msg: "Routing connections and revision loops…" },
  { at: 9000, msg: "Validating flowchart logic…" },
  { at: 12000, msg: "Finalizing your diagram…" },
  { at: 18000, msg: "Complex design — refining the structure…" },
];
const UPLOAD_STAGES = [
  { at: 0, msg: "Opening your document…" },
  { at: 2000, msg: "Locating the methodology section…" },
  { at: 5000, msg: "Extracting the research design…" },
  { at: 8000, msg: "Structuring phases and decision gates…" },
  { at: 12000, msg: "Validating flowchart logic…" },
  { at: 16000, msg: "Finalizing your diagram…" },
];
const REFINE_STAGES = [
  { at: 0, msg: "Reading your instruction…" },
  { at: 1500, msg: "Applying the change…" },
  { at: 4000, msg: "Validating flowchart logic…" },
  { at: 7000, msg: "Finalizing…" },
];

function MFNode({ data, selected }: NodeProps<Node<D>>) {
  const w = data.w || 200;
  const h = data.h || 70;
  const style = {
    width: w,
    height: h,
    "--node-fill": data.fill || "#fff",
    "--node-stroke": data.stroke || "var(--ink)",
  } as React.CSSProperties;
  return (
    <div className={"mf mf-" + data.shape + (selected ? " is-sel" : "")} style={style}>
      {data.shape === "decision" && (
        <svg className="mf-dia" viewBox="0 0 200 96" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="100,1.5 198.5,48 100,94.5 1.5,48" style={{ fill: "var(--node-fill)", stroke: "var(--node-stroke)" }} />
        </svg>
      )}
      <Handle type="target" position={Position.Top} id="t" />
      <Handle type="source" position={Position.Bottom} id="b" />
      <Handle type="target" position={Position.Left} id="l" />
      <Handle type="source" position={Position.Right} id="r" />
      <span className="mf-t" style={{ color: data.text || "var(--ink)" }}>
        {data.label}
      </span>
    </div>
  );
}
const nodeTypes = { mf: MFNode };

type PtEdge = { points?: { x: number; y: number }[]; labelPos?: { x: number; y: number; anchor: string } };
function MFEdge(p: EdgeProps) {
  const d = (p.data ?? {}) as PtEdge;
  const pts = d.points;
  let path: string;
  let lx = (p.sourceX + p.targetX) / 2;
  let ly = (p.sourceY + p.targetY) / 2;
  if (pts && pts.length >= 2) {
    path = pts.map((q, i) => (i === 0 ? "M" : "L") + q.x + "," + q.y).join(" ");
    if (d.labelPos) {
      lx = d.labelPos.x;
      ly = d.labelPos.y;
    }
  } else {
    const r = getSmoothStepPath({
      sourceX: p.sourceX,
      sourceY: p.sourceY,
      sourcePosition: p.sourcePosition,
      targetX: p.targetX,
      targetY: p.targetY,
      targetPosition: p.targetPosition,
    });
    path = r[0];
    lx = r[1];
    ly = r[2];
  }
  return (
    <>
      <BaseEdge id={p.id} path={path} markerEnd={p.markerEnd} style={p.style} interactionWidth={16} />
      {p.label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)`,
              fontSize: 11,
              background: "#fff",
              padding: "0 3px",
              borderRadius: 2,
              pointerEvents: "none",
            }}
          >
            {p.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
const edgeTypes = { mf: MFEdge };

function Modal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const [c, setC] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <textarea readOnly value={text} rows={12} onFocus={(e) => e.currentTarget.select()} />
        <div className="row">
          <button
            className="pri"
            onClick={async () => {
              setC(await copy(text));
              setTimeout(() => setC(false), 1500);
            }}
          >
            {c ? "Copied" : "Copy"}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Inner() {
  const s = useDiagram();
  const { ir, sel, rev, past, future } = s;
  const rf = useReactFlow();
  const router = useRouter();
  const openUpgrade = useUpgradeStore((state) => state.open);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<D>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<RequestMethod>("auto");
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [refineText, setRefineText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showPromptGuide, setShowPromptGuide] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasClickedNode, setHasClickedNode] = useState(true);
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<"l" | "r" | null>(null);
  const [code, setCode] = useState<{ title: string; text: string } | null>(null);
  const [grp, setGrp] = useState("");
  const [page, setPage] = useState<PageSettings>(DEFAULT_PAGE);
  const pinfo = useMemo(() => printInfo(ir, page), [ir, page]);
  const [cloudId, setCloudId] = useState<string | null>(null);
  const [genError, setGenError] = useState<{ title: string; detail: string; retryable: boolean; templateIR?: IR } | null>(null);
  // Monotonic id for AI requests: a slow response from an earlier generation/refine/upload
  // must never overwrite the result of a newer one.
  const aiSeq = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const planRef = useRef<"free" | "pro">("free");
  const planReady = useRef<Promise<void>>(Promise.resolve());
  const applyPlan = (p: "free" | "pro") => {
    planRef.current = p;
    setPlan(p);
  };

  // Thinking overlay state
  const [genStage, setGenStage] = useState("");
  const [genProgress, setGenProgress] = useState(0);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const booted = useRef(false);
  const irRef = useRef(ir);
  irRef.current = ir;
  const checks = useMemo(() => validateGraph(ir), [ir]);
  const pal = getPalette(ir.meta.paletteId);

  const rp = resolvePage(page, (ir as any).canvas?.width ?? 600, (ir as any).canvas?.height ?? 800, 14);
  const isLand = rp.orientation === "landscape";
  const pw = isLand ? 297 : 210;
  const ph = isLand ? 210 : 297;
  const pageW = pw * 3.7795;
  const pageH = ph * 3.7795;

  const groupBoxes = useMemo(() => {
    return ir.groups.map((g: any, i) => {
      if (typeof g.x !== "number") return null;
      const tint = g.color ?? pal.groupTints[i % pal.groupTints.length];
      return (
        <div
          key={g.id}
          style={{
            position: "absolute",
            transform: `translate(${g.x}px, ${g.y}px)`,
            width: g.w,
            height: g.h,
            backgroundColor: tint,
            border: `1px solid ${pal.accent}22`,
            borderRadius: 8,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: pal.accent,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {g.label}
          </div>
        </div>
      );
    });
  }, [ir.groups, pal]);

  useEffect(
    () => () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("mf:onboarded")) setShowOnboarding(true);
    if (localStorage.getItem("mf:clicked-node")) setHasClickedNode(true);
    else setHasClickedNode(false);
  }, []);

  function dismissOnboarding() {
    setShowOnboarding(false);
    try {
      localStorage.setItem("mf:onboarded", "1");
    } catch {}
  }

  function markNodeClicked() {
    if (!hasClickedNode) {
      setHasClickedNode(true);
      try {
        localStorage.setItem("mf:clicked-node", "1");
      } catch {}
    }
  }

  function startProgress(stages: { at: number; msg: string }[]) {
    if (stageTimer.current) clearInterval(stageTimer.current);
    const start = Date.now();
    setGenProgress(0);
    setGenStage(stages[0].msg);
    stageTimer.current = setInterval(() => {
      const e = Date.now() - start;
      let msg = stages[0].msg;
      for (const st of stages) if (e >= st.at) msg = st.msg;
      const last = stages[stages.length - 1].at;
      const p = Math.min(95, (e / (last + 6000)) * 95);
      setGenStage(msg);
      setGenProgress(p);
    }, 180);
  }

  function finishProgress(ok: boolean) {
    if (stageTimer.current) {
      clearInterval(stageTimer.current);
      stageTimer.current = null;
    }
    if (ok) {
      setGenProgress(100);
      setGenStage("Done — rendering your diagram…");
      setTimeout(() => {
        setBusy(false);
        setGenProgress(0);
        setGenStage("");
      }, 600);
    } else {
      setBusy(false);
      setGenProgress(0);
      setGenStage("");
    }
  }

  useEffect(() => {
    const supabase = createClient();
    let done: () => void = () => {};
    planReady.current = new Promise<void>((r) => (done = r));
    const fetchUserAndPlan = async () => {
      try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
        if (profile) applyPlan(profile.plan as "free" | "pro");
      }
      } finally {
        done();
      }
    };
    fetchUserAndPlan();
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("plan")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data) applyPlan(data.plan as "free" | "pro");
          });
      } else {
        applyPlan("free");
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setPage(loadPageSettings());
  }, []);
  useEffect(() => {
    savePageSettings(page);
  }, [page]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const t = params.get("t");
    const init = async () => {
      if (params.get("new") === "1") {
        startNewProject(false);
        booted.current = true;
        return;
      }
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
  }, []);

  useEffect(() => {
    setNodes(
      ir.nodes.map((n) => {
        const anyNode = n as any;
        const palShape = pal.shapes[n.shape];
        return {
          id: n.id,
          type: "mf",
          position: { x: anyNode.x ?? 0, y: anyNode.y ?? 0 },
          data: {
            label: n.label,
            shape: n.shape,
            fill: n.fill || palShape?.fill,
            stroke: n.stroke || palShape?.stroke,
            text: n.text || palShape?.text,
            w: anyNode.w,
            h: anyNode.h,
          },
          selected: sel?.k === "n" && sel.id === n.id,
        };
      })
    );
  }, [ir, sel, setNodes, pal]);

  useEffect(() => {
    setEdges(
      ir.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        type: "mf",
        data: { points: (e as any).points, labelPos: (e as any).labelPos },
        selected: sel?.k === "e" && sel.id === e.id,
        style: { stroke: pal.ink, strokeWidth: 1.4, strokeDasharray: e.dashed ? "6 4" : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: pal.ink, width: 20, height: 20, markerUnits: "userSpaceOnUse" },
        labelStyle: { fontSize: 11, fill: pal.ink },
        labelBgStyle: { fill: "#fff" },
      }))
    );
  }, [ir, sel, setEdges, pal.ink]);

  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.2, duration: 200 }), 60);
    return () => clearTimeout(t);
  }, [rev, rf]);

  useEffect(() => {
    if (!booted.current) return;
    const t = setTimeout(
      () => setStatus(saveDraft(ir) ? "Saved in this browser" : "Not saved: browser storage is blocked or full. Export JSON."),
      800
    );
    return () => clearTimeout(t);
  }, [ir]);

  useEffect(() => {
    const h = () => {
      if (booted.current) saveDraft(irRef.current);
    };
    const v = () => {
      if (document.visibilityState === "hidden") h();
    };
    window.addEventListener("pagehide", h);
    document.addEventListener("visibilitychange", v);
    return () => {
      window.removeEventListener("pagehide", h);
      document.removeEventListener("visibilitychange", v);
    };
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      const m = e.metaKey || e.ctrlKey,
        c = e.key.toLowerCase(),
        g = useDiagram.getState();
      if (m && c === "z") {
        e.preventDefault();
        e.shiftKey ? g.redo() : g.undo();
      } else if (m && c === "y") {
        e.preventDefault();
        g.redo();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  function loadExample() {
    setMethod("auto");
    setText(
      "A cross-sectional survey was conducted with 250 postgraduate students recruited through stratified random sampling. Data were collected using a validated 45-item online questionnaire. Ethical approval was obtained from the institutional review board prior to data collection. Instrument reliability was confirmed with a Cronbach's alpha of 0.89. Responses were analyzed using descriptive statistics, Pearson correlation, and hierarchical multiple regression in SPSS."
    );
    setMsg("Example methodology loaded with Auto-detect selected. Click 'Generate flowchart' to see the result.");
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  /**
   * Start genuinely fresh: clear the saved browser draft, reset the IR and undo history,
   * forget the cloud diagram id and clear AI inputs. Without this, /app always reloaded the
   * previous draft, so "New project" appeared to keep the old diagram.
   */
  function startNewProject(openCreate: boolean, ask = false) {
    if (ask && useDiagram.getState().ir.nodes.length > 1 && !confirm("Start a new diagram? The current one stays in this browser until it is replaced.")) return;
    aiSeq.current++; // invalidate any in-flight AI response for the old diagram
    clearDraft();
    useDiagram.getState().newProject();
    setCloudId(null);
    setGenError(null);
    setMsg("");
    setText("");
    setExtra("");
    setRefineText("");
    setUploadedFile(null);
    setPanel(openCreate ? "l" : null);
    window.history.replaceState(null, "", "/app");
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
    setBusy(true);
    setMsg("Saving to cloud...");
    try {
      const supabase = createClient();
      const d = useDiagram.getState().ir;
      if (cloudId) {
        const { error } = await supabase
          .from("diagrams")
          .update({ ir: d, title: d.meta.title, updated_at: new Date().toISOString() })
          .eq("id", cloudId);
        if (error) throw error;
        setMsg("Saved to cloud.");
      } else {
        const { data, error } = await supabase
          .from("diagrams")
          .insert({ user_id: user.id, ir: d, title: d.meta.title })
          .select("id")
          .single();
        if (error) throw error;
        setCloudId(data.id);
        window.history.replaceState(null, "", `?id=${data.id}`);
        setMsg("Saved to cloud.");
      }
    } catch (e: any) {
      setMsg(e.message || "Failed to save to cloud.");
    } finally {
      setBusy(false);
    }
  }

  async function gen() {
    const seq = ++aiSeq.current;
    setBusy(true);
    setMsg("");
    setGenError(null);
    startProgress(GEN_STAGES);
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 130_000);
      let r: Response;
      try {
        r = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ methodology: method, text, extra }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (seq !== aiSeq.current) return; // a newer AI action owns the canvas now
      const j = await r.json().catch(() => null);
      if (seq !== aiSeq.current) return;
      if (r.status === 429) {
        setMsg("");
        openUpgrade("limit");
      } else if (!r.ok || !j) {
        const code = (j?.code as GenErrorCode | undefined) ?? "unavailable";
        console.error("[generate] technical failure:", r.status, j?.reason ?? j?.message);
        setGenError({
          title: "Couldn't generate a new diagram",
          detail: `${friendlyGenerationError(code)} ${generationErrorHint}`,
          retryable: true,
        });
        setMsg("Generation failed — your previous diagram is unchanged.");
      } else {
        const p = IRSchema.safeParse(j.ir);
        const code = (j.code as GenErrorCode | undefined) ?? classifyFailure([String(j.reason ?? "")]);
        if (j.source === "template" || !p.success) {
          // Never show provider names, model ids, Zod paths or stack details to users.
          // The technical reason stays in the browser console for debugging/support.
          console.error("[generate] technical reason:", j.reason ?? "invalid IR received from server");
          setGenError({
            title: "Couldn't generate a new diagram",
            detail: `${friendlyGenerationError(code)} ${generationErrorHint}${p.success ? " You can retry, or load a generic template to start from." : ""}`,
            retryable: true,
            templateIR: p.success ? p.data : undefined,
          });
          setMsg("Generation failed — your previous diagram is unchanged.");
        } else {
          const g = useDiagram.getState();
          g.commit(layout(withStyle(p.data, g.ir.meta)));
          useDiagram.setState((x) => ({ rev: x.rev + 1 }));
          const detected = method === "auto" || p.data.meta.methodology !== method ? `Detected design: ${ML[p.data.meta.methodology as Method] ?? p.data.meta.methodology}. ` : "";
          setMsg(detected + ((j.warnings as string[] | undefined)?.join(" ") || "Draft ready. Check every step against your own method."));
          setPanel(null);
          setGenError(null);
          ok = true;
        }
      }
    } catch (e) {
      if (seq !== aiSeq.current) return;
      const aborted = e instanceof DOMException && e.name === "AbortError";
      console.error("[generate] technical failure:", e);
      setGenError({
        title: "Couldn't generate a new diagram",
        detail: `${friendlyGenerationError(aborted ? "timeout" : "unavailable")} ${generationErrorHint}`,
        retryable: true,
      });
      setMsg(aborted ? "Generation timed out — your previous diagram is unchanged." : "Network error — your previous diagram is unchanged.");
    } finally {
      if (seq === aiSeq.current) finishProgress(ok);
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    if (plan === "free") {
      openUpgrade("feature");
      return;
    }
    const seq = ++aiSeq.current;
    setUploadedFile(file.name);
    setBusy(true);
    setMsg("");
    setGenError(null);
    startProgress(UPLOAD_STAGES);
    let ok = false;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: formData });
      if (seq !== aiSeq.current) return;
      const rawText = await r.text();
      let j: any;
      try {
        j = JSON.parse(rawText);
      } catch {
        if (!r.ok) throw new Error(`Server Error: ${r.status} ${r.statusText}`);
        throw new Error("Invalid response from server");
      }
      if (seq !== aiSeq.current) return;
      if (!r.ok) {
        setGenError({ title: "Upload failed", detail: j.message || `The server returned ${r.status}. Your previous diagram is unchanged.`, retryable: false });
        setMsg(j.message || "Upload failed.");
      } else {
        const p = IRSchema.safeParse(j.ir);
        if (j.source === "template") {
          console.error("[upload] technical reason:", j.reason ?? "template fallback");
          setGenError({
            title: "No diagram was generated from that document",
            detail: "The uploaded document did not yield a usable diagram, so your previous diagram is unchanged. Try a text-based PDF or DOCX, or a shorter document.",
            retryable: false,
          });
          setMsg("Upload failed — your previous diagram is unchanged.");
        } else if (!p.success) {
          setGenError({ title: "The generated diagram was invalid", detail: "It was discarded, so your previous diagram is unchanged.", retryable: false });
          setMsg("The result was not valid.");
        } else {
          const g = useDiagram.getState();
          g.commit(layout(withStyle(p.data, g.ir.meta)));
          useDiagram.setState((x) => ({ rev: x.rev + 1 }));
          setMsg(`Draft ready from uploaded document. Detected design: ${ML[p.data.meta.methodology as Method] ?? p.data.meta.methodology}.`);
          setPanel(null);
          ok = true;
        }
      }
    } catch (err: any) {
      if (seq !== aiSeq.current) return;
      console.error("[upload] technical failure:", err);
      setGenError({ title: "Upload failed", detail: "The file could not be processed. Your previous diagram is unchanged — check the file and try again.", retryable: false });
      setMsg("Network error during upload.");
    } finally {
      setUploadedFile(null);
      if (seq === aiSeq.current) finishProgress(ok);
    }
  }

  const SIMPLIFY =
    "Simplify this flowchart so it stays legible on one printed page: merge microsteps that share an input, output and purpose into single steps, keep every decision gate, revision loop and parallel strand, and aim for 14 to 18 nodes in total. Do not remove any essential stage and do not add new steps.";

  async function doRefine() {
    return runRefine(refineText, true);
  }

  async function runRefine(instruction: string, clearAfter: boolean) {
    if (!instruction.trim()) return;
    const seq = ++aiSeq.current;
    setBusy(true);
    setMsg("");
    setGenError(null);
    startProgress(REFINE_STAGES);
    let ok = false;
    try {
      const r = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ir: useDiagram.getState().ir, instruction }),
      });
      if (seq !== aiSeq.current) return;
      const j = await r.json().catch(() => null);
      if (seq !== aiSeq.current) return;
      if (r.status === 429) {
        setMsg("");
        openUpgrade("limit");
      } else if (!r.ok || !j) {
        setGenError({ title: "Refine failed", detail: `${j?.message || `The server returned ${r.status}.`} Your diagram is unchanged.`, retryable: false });
        setMsg(j?.message || "Refine failed.");
      } else {
        const p = IRSchema.safeParse(j.ir);
        if (j.source === "template") {
          setGenError({ title: "The refinement could not be applied", detail: "The AI could not apply that edit, so your diagram is unchanged. Try rephrasing the instruction.", retryable: false });
          setMsg("The edit could not be applied, so your diagram is unchanged. Try rephrasing the instruction.");
        } else if (!p.success) {
          setGenError({ title: "The refined diagram was invalid", detail: "It was discarded, so your diagram is unchanged.", retryable: false });
          setMsg("The result was not valid. Your diagram is unchanged.");
        } else {
          const g = useDiagram.getState();
          g.commit(layout(withStyle(p.data, g.ir.meta)));
          useDiagram.setState((x) => ({ rev: x.rev + 1 }));
          setMsg("Refined successfully.");
          if (clearAfter) {
            setRefineText("");
            setPanel(null);
          }
          ok = true;
        }
      }
    } catch (e) {
      if (seq !== aiSeq.current) return;
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setGenError({ title: aborted ? "Refine timed out" : "Network error", detail: "Your diagram is unchanged. Check the connection and try again.", retryable: false });
      setMsg(aborted ? "Refine timed out. Your diagram is unchanged." : "Network error. Your diagram is unchanged.");
    } finally {
      if (seq === aiSeq.current) finishProgress(ok);
    }
  }

  async function exp(k: string) {
    await planReady.current;
    const free = planRef.current === "free";
    if ((k === "docx" || k === "tikz") && free) {
      setMenu(false);
      openUpgrade("feature");
      return;
    }
    setMenu(false);
    const d = useDiagram.getState().ir;
    const n = slug(d.meta.title);
    setMsg("");
    let pageForExport = page;
    let promoted = false;
    if (k === "svg" || k === "png" || k === "pdf" || k === "docx") {
      const plan = bestPrintPlan(d, page);
      if (plan.pt < 6) {
        setMsg(
          `This figure would print labels at ${plan.pt.toFixed(1)} pt even on ${plan.page.size.toUpperCase()} ${plan.page.orientation} — too small for a thesis. Choose A3, click "Fit to one page", or simplify the diagram, then export again.`
        );
        return;
      }
      pageForExport = plan.page;
      promoted = plan.promoted;
      if (promoted) {
        setPage(plan.page);
        setMsg(
          `Exported on ${plan.page.size.toUpperCase()} ${plan.page.orientation}: labels print at ${plan.pt.toFixed(1)} pt. ${plan.reason}`
        );
      } else if (plan.pt < 7) {
        setMsg(`Labels print at ${plan.pt.toFixed(1)} pt — just under the 7 pt thesis threshold. A3 or "Fit to one page" gives a larger figure.`);
      }
    }
    try {
      if (k === "svg") {
        download(new Blob([toSVG(d, pageForExport.theme, pageForExport.font, undefined, free, contentBoxes(pageForExport)).svg], { type: "image/svg+xml" }), n + ".svg");
        if (free) setTimeout(() => openUpgrade("watermark"), 800);
      } else if (k === "png") {
        download((await toPng(d, pageForExport, free)).blob, n + ".png");
        if (free) setTimeout(() => openUpgrade("watermark"), 800);
      } else if (k === "pdf") {
        download(await toPdf(d, pageForExport, free), n + ".pdf");
        if (free) setTimeout(() => openUpgrade("watermark"), 800);
      } else if (k === "docx") download(await toDocx(d, pageForExport, free), n + ".docx");
      else if (k === "json") download(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), n + ".methodflow.json");
      else if (k === "mermaid") setCode({ title: "Mermaid", text: toMermaid(d) });
      else if (k === "tikz") setCode({ title: "LaTeX (TikZ)", text: toTikz(d) });
    } catch {
      setMsg(promoted ? `Export failed after switching to ${pageForExport.size.toUpperCase()} ${pageForExport.orientation}. Try PNG or SVG.` : "Export failed. Try PNG or SVG.");
    }
  }

  async function share() {
    setMenu(false);
    setMsg("");
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ir: useDiagram.getState().ir }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.message || "Could not create a link.");
        return;
      }
      setCode({ title: "Read-only link (kept 90 days)", text: location.origin + "/s/" + j.slug });
    } catch {
      setMsg("Network error. No link was created.");
    }
  }

  async function imp(f?: File) {
    if (!f) return;
    if (f.size > 2e5) {
      setMsg("File is too large.");
      return;
    }
    const ir2 = parseIR(await f.text());
    if (!ir2) {
      setMsg("That file is not a MethodFlow JSON diagram.");
      return;
    }
    useDiagram.getState().commit(ir2);
    useDiagram.setState((x) => ({ rev: x.rev + 1 }));
  }

  const selNode = sel?.k === "n" ? ir.nodes.find((n) => n.id === sel.id) : undefined;
  const selEdge = sel?.k === "e" ? ir.edges.find((e) => e.id === sel.id) : undefined;

  return (
    <div className="app">
      <header className="bar">
        <Link href="/" className="brand">
          MethodFlow
        </Link>
        <input
          className="title"
          value={ir.meta.title}
          maxLength={120}
          onChange={(e) => s.patchTitle(e.target.value)}
          aria-label="Diagram title"
        />
        <span className="status" role="status">
          {status}
        </span>
        <span className="sp" />
        <button className="m-only" onClick={() => setPanel(panel === "l" ? null : "l")}>
          Create
        </button>
        <button className="m-only" onClick={() => setPanel(panel === "r" ? null : "r")}>
          Edit
        </button>
        <button onClick={saveCloud} disabled={busy} style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
          Save to Cloud
        </button>
        <button onClick={() => startNewProject(true, true)} disabled={busy} title="Start a fresh diagram (old draft is cleared)">
          New
        </button>
        <button onClick={s.undo} disabled={!past.length} aria-label="Undo">
          Undo
        </button>
        <button onClick={s.redo} disabled={!future.length} aria-label="Redo">
          Redo
        </button>
        <button onClick={s.relayout}>Auto-layout</button>
        <button onClick={() => setShowGuide(!showGuide)}>{showGuide ? "Hide A4" : "Show A4"}</button>

        {user ? (
          <div className="row" style={{ alignItems: "center", gap: 8, marginLeft: 8 }}>
            <Link
              href="/dashboard"
              className="btn ghost"
              style={{ padding: "5px 10px", fontSize: 13, textDecoration: "none" }}
              title={user.email}
            >
              My Dashboard
            </Link>
            <button onClick={handleSignOut} style={{ fontSize: 13, padding: "5px 10px" }}>
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="btn ghost"
            style={{ padding: "5px 10px", fontSize: 14, marginLeft: 8, textDecoration: "none" }}
          >
            Sign in
          </Link>
        )}

        <div className="menu">
          <button className="pri" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            Export
          </button>
          {menu && (
            <div className="pop" role="menu">
              {[
                ["png", "PNG image"],
                ["svg", "SVG vector"],
                ["pdf", "PDF"],
                ["docx", "Word (.docx) with caption"],
                ["mermaid", "Mermaid code"],
                ["tikz", "LaTeX TikZ code"],
                ["json", "JSON (re-importable)"],
              ].map(([k, l]) => (
                <button key={k} role="menuitem" onClick={() => exp(k)}>
                  {l}
                </button>
              ))}
              <hr />
              <button role="menuitem" onClick={share}>
                Create read-only link
              </button>
            </div>
          )}
        </div>
      </header>

      {genError && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 64,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            width: "calc(100% - 32px)",
            maxWidth: 780,
            background: "#fff7f7",
            border: "1px solid #f3b4b4",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,.14)",
            padding: "12px 16px",
            color: "#7f1d1d",
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}>
              <strong style={{ fontSize: 15 }}>{genError.title}</strong>
              <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 2 }}>{genError.detail}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {genError.retryable && (
                <button className="btn" disabled={busy} onClick={() => gen()}>
                  Retry generation
                </button>
              )}
              {genError.templateIR && (
                <button
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => {
                    const tpl = genError?.templateIR;
                    if (!tpl) return;
                    const g = useDiagram.getState();
                    g.commit(layout(withStyle(tpl, g.ir.meta)));
                    useDiagram.setState((x) => ({ rev: x.rev + 1 }));
                    setGenError(null);
                    setMsg("Loaded the fallback template — check every step against your methods.");
                  }}
                >
                  Use fallback template
                </button>
              )}
              <button onClick={() => setGenError(null)} aria-label="Dismiss error">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="side left" data-open={panel === "l"}>
        {showOnboarding && (
          <div
            style={{
              background: "linear-gradient(135deg, #EAF0F6 0%, #F2E9F1 100%)",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 12,
              position: "relative",
            }}
          >
            <button
              onClick={dismissOnboarding}
              aria-label="Dismiss welcome banner"
              style={{
                position: "absolute",
                top: 6,
                right: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
                color: "var(--slate)",
                padding: 2,
              }}
            >
              ×
            </button>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, marginBottom: 8, paddingRight: 20 }}>Welcome to MethodFlow</p>
            <ol style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: "var(--graphite)", lineHeight: 1.75 }}>
              <li>
                Paste your methodology (or click <em>Try an example</em>)
              </li>
              <li>
                Click <strong>Generate flowchart</strong>
              </li>
              <li>Click any step on the canvas to edit it</li>
            </ol>
          </div>
        )}

        <h2>Generate from your method</h2>
        <label className="f">
          Research design
          <select value={method} onChange={(e) => setMethod(e.target.value as RequestMethod)}>
            {REQUEST_METHODS.map((m) => (
              <option key={m} value={m}>
                {RL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          Key details
          <input
            value={extra}
            maxLength={300}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Optional: sample size, instruments, analysis"
          />
        </label>
        <label className="f">
          Methodology text
          <textarea
            value={text}
            maxLength={plan === "pro" ? 20000 : 8000}
            rows={10}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g., A cross-sectional survey of 250 students using stratified random sampling. Data collected via a 40-item questionnaire and analyzed using multiple regression in SPSS."
            style={{ resize: "vertical", minHeight: 180 }}
          />
        </label>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -4, marginBottom: 8 }}>
          <button
            className="note"
            style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            onClick={loadExample}
          >
            Try an example
          </button>
          <button
            className="note"
            style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            onClick={() => setShowPromptGuide(true)}
          >
            How to write a great prompt
          </button>
        </div>
        <button className="pri wide" onClick={gen} disabled={busy}>
          {busy ? "Generating…" : "Generate flowchart"}
        </button>

        <div style={{ marginTop: 8, marginBottom: 24, textAlign: "center" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 12px",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
              cursor: busy ? "wait" : "pointer",
              fontSize: 13,
              color: "var(--graphite)",
              background: "transparent",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {busy && uploadedFile ? `Processing ${uploadedFile}...` : "Or upload a PDF / DOCX"}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>
          <p className="note" style={{ marginTop: 8, fontSize: 11 }}>
            <strong>Pro tip:</strong> Include sample size, instruments, and analysis methods in your text for the most accurate
            diagram.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 16 }}>
          <h2 style={{ margin: 0 }}>Refine with AI</h2>
          <button
            className="note"
            style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
            onClick={() => setShowPromptGuide(true)}
          >
            Guide
          </button>
        </div>
        <label className="f">
          Instruction
          <input
            value={refineText}
            maxLength={500}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="e.g., Add a decision gate for missing data"
          />
        </label>
        <button className="wide" onClick={doRefine} disabled={busy || !refineText.trim()}>
          {busy ? "Refining…" : "Apply Edit"}
        </button>

        {msg && (
          <p className="note" role="status" style={{ marginTop: 8 }}>
            {msg}
          </p>
        )}
        <h2>Templates</h2>
        <ul className="list">
          {TEMPLATES.map((t) => (
            <li key={t.slug}>
              <button
                onClick={() => {
                  useDiagram.getState().commit(t.ir);
                  useDiagram.setState((x) => ({ rev: x.rev + 1 }));
                  setPanel(null);
                }}
              >
                {t.title.replace(/ flowchart| flow diagram| template/gi, "")}
              </button>
            </li>
          ))}
        </ul>
        <h2>Add shape</h2>
        <div className="grid">
          {SHAPES.map((sh) => (
            <button key={sh} onClick={() => s.addNode(sh)}>
              {SL[sh]}
            </button>
          ))}
        </div>
        <h2>File</h2>
        <label className="file">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              imp(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </aside>

      <main className="canvas" aria-label="Diagram canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(c) => c.source && c.target && s.connect(c.source, c.target)}
          onNodeClick={(_, n) => {
            s.select({ k: "n", id: n.id });
            markNodeClicked();
          }}
          onEdgeClick={(_, e) => s.select({ k: "e", id: e.id })}
          onPaneClick={() => s.select(null)}
          onNodeDragStop={(_, n) => s.move(n.id, Math.round(n.position.x), Math.round(n.position.y))}
          onNodesDelete={(d) =>
            s.remove(
              d.map((n) => n.id),
              []
            )
          }
          onEdgesDelete={(d) =>
            s.remove(
              [],
              d.map((e) => e.id)
            )
          }
          deleteKeyCode={["Backspace", "Delete"]}
          snapToGrid
          snapGrid={[8, 8]}
          minZoom={0.2}
          maxZoom={2}
          fitView
        >
          <ViewportPortal>
            {showGuide && (
              <div style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: -2 }}>
                <svg width={pageW} height={pageH} style={{ overflow: "visible" }}>
                  <rect
                    width="100%"
                    height="100%"
                    fill="#fff"
                    stroke="#d1d5db"
                    strokeWidth={2}
                    style={{ filter: "drop-shadow(0px 4px 12px rgba(0,0,0,0.05))" }}
                  />
                  <text x={pageW / 2} y={-20} textAnchor="middle" fontSize={18} fill="#9ca3af" fontWeight="bold">
                    {page.size.toUpperCase()} {rp.orientation.toUpperCase()} ({pw}×{ph}mm)
                  </text>
                </svg>
              </div>
            )}
            {groupBoxes}
          </ViewportPortal>
          <Background gap={24} size={1} color="#D9DEE3" />
          <Controls showInteractive={false} />
        </ReactFlow>

        {!hasClickedNode && !sel && ir.nodes.length > 0 && !busy && (
          <div
            style={{
              position: "absolute",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--ink)",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 24,
              fontSize: 13,
              fontWeight: 500,
              pointerEvents: "none",
              zIndex: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            Click any step on the canvas to edit it
          </div>
        )}

        {busy && (
          <div className="gen-overlay">
            <div className="gen-card">
              <div className="thinking-dots">
                <span />
                <span />
                <span />
              </div>
              <p className="gen-stage">{genStage}</p>
              <div className="gen-bar">
                <div
                  className="gen-fill"
                  style={{ width: `${genProgress}%`, background: genProgress === 100 ? "#2E6B45" : "var(--accent)" }}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <aside className="side right" data-open={panel === "r"}>
        {selNode ? (
          <>
            <h2>Step</h2>
            <label className="f">
              Label
              <input value={selNode.label} maxLength={120} onChange={(e) => s.patchNode(selNode.id, { label: e.target.value || " " })} />
            </label>
            <label className="f">
              Shape
              <select value={selNode.shape} onChange={(e) => s.patchNode(selNode.id, { shape: e.target.value as Shape })}>
                {SHAPES.map((sh) => (
                  <option key={sh} value={sh}>
                    {SL[sh]}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Phase
              <select
                value={selNode.groupId ?? ""}
                onChange={(e) => s.patchNode(selNode.id, { groupId: e.target.value || undefined })}
              >
                <option value="">None</option>
                {ir.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <h3 style={{ fontSize: 13, margin: "8px 0 4px" }}>Colour</h3>
            <div className="swatches">
              {SWATCHES.map((sw, i) => (
                <button
                  key={i}
                  title={sw.name}
                  className="sw"
                  style={{ background: sw.fill || "#fff", borderColor: sw.stroke || "#ccc" }}
                  onClick={() =>
                    s.setNodeColor(
                      selNode.id,
                      sw.fill ? { fill: sw.fill, stroke: sw.stroke } : { fill: undefined, stroke: undefined }
                    )
                  }
                />
              ))}
            </div>
            <label className="f">
              Notes
              <textarea
                rows={3}
                maxLength={300}
                value={selNode.notes ?? ""}
                onChange={(e) => s.patchNode(selNode.id, { notes: e.target.value || undefined })}
              />
            </label>
            <button className="danger" onClick={() => s.remove([selNode.id], [])}>
              Delete step
            </button>
          </>
        ) : selEdge ? (
          <>
            <h2>Connector</h2>
            <label className="f">
              Label
              <input
                value={selEdge.label ?? ""}
                maxLength={40}
                onChange={(e) => s.patchEdge(selEdge.id, { label: e.target.value || undefined })}
                placeholder="Yes / No"
              />
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={!!selEdge.dashed}
                onChange={(e) => s.patchEdge(selEdge.id, { dashed: e.target.checked || undefined })}
              />
              Dashed line
            </label>
            <button className="danger" onClick={() => s.remove([], [selEdge.id])}>
              Delete connector
            </button>
          </>
        ) : (
          <>
            <h2>Diagram Style</h2>
            <label className="f">
              Palette
              <select value={ir.meta.paletteId ?? "mono"} onChange={(e) => s.setPalette(e.target.value as PaletteId)}>
                {PALETTE_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Density
              <select value={ir.meta.density ?? "spacious"} onChange={(e) => s.setDensity(e.target.value as Density)}>
                {DENSITIES.map((d) => (
                  <option key={d} value={d}>
                    {DL[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="f">
              Flow
              <select
                value={ir.meta.flowDirection ?? "auto"}
                onChange={(e) => s.setFlowDirection(e.target.value as FlowDirection)}
              >
                {(Object.keys(FL) as FlowDirection[]).map((f) => (
                  <option key={f} value={f}>
                    {FL[f]}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ fontSize: 11, opacity: 0.5, margin: "4px 0" }}>Engine 3 · build {process.env.NEXT_PUBLIC_BUILD}</div>
            {pinfo.level !== "good" ? (
              <div style={{ fontSize: 12, lineHeight: 1.4, margin: "6px 0", color: pinfo.level === "small" ? "#b45309" : "inherit" }}>
                Text prints at about {pinfo.pt.toFixed(1)} pt on this page.
                {pinfo.level === "small" ? " That is hard to read in a thesis." : ""}
                {" "}
                <button type="button" className="btn" disabled={busy} onClick={() => s.fitToPage()}>
                  Fit to one page
                </button>
                {pinfo.nodes > 16 ? (
                  <>
                    {" "}
                    <button type="button" className="btn" disabled={busy} onClick={() => runRefine(SIMPLIFY, false)}>
                      Simplify to a thesis figure
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
              <label className="f">
                Page
                <select value={page.size} onChange={(e) => setPage({ ...page, size: e.target.value as PageSettings["size"] })}>
                  <option value="a4">A4</option>
                  <option value="a5">A5</option>
                  <option value="a3">A3</option>
                  <option value="letter">Letter</option>
                  <option value="legal">Legal</option>
                </select>
              </label>
              <label className="f">
                Orientation
                <select
                  value={page.orientation}
                  onChange={(e) => setPage({ ...page, orientation: e.target.value as PageSettings["orientation"] })}
                >
                  <option value="auto">Auto (best fit)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label className="f">
                Margin mm
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={page.margin}
                  onChange={(e) => setPage({ ...page, margin: Math.max(5, Math.min(40, Number(e.target.value) || 20)) })}
                />
              </label>
              <label className="f">
                Font
                <select value={page.font} onChange={(e) => setPage({ ...page, font: e.target.value as PageSettings["font"] })}>
                  <option value="sans">Sans</option>
                  <option value="serif">Serif</option>
                </select>
              </label>
              <button
                type="button"
                className="btn"
                style={{ gridColumn: "1 / -1", marginTop: 2 }}
                onClick={() =>
                  setPage({ ...page, size: "a4", orientation: "auto", margin: 20, fit: "fit", dpi: 300, font: "serif", theme: "mono" })
                }
              >
                Thesis preset (A4, serif, mono)
              </button>
            </div>

            <h2 style={{ marginTop: 16 }}>Phases</h2>
            <ul className="list">
              {ir.groups.map((g, i) => (
                <li key={g.id} className="split">
                  <span>{g.label}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <input
                      type="color"
                      value={g.color ?? pal.groupTints[i % pal.groupTints.length]}
                      onChange={(e) => s.setGroupColor(g.id, e.target.value)}
                      title="Phase colour"
                      className="col"
                    />
                    <button onClick={() => s.removeGroup(g.id)} aria-label={"Remove " + g.label}>
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                s.addGroup(grp);
                setGrp("");
              }}
            >
              <input
                value={grp}
                maxLength={60}
                onChange={(e) => setGrp(e.target.value)}
                placeholder="New phase"
                aria-label="New phase name"
              />
              <button type="submit">Add</button>
            </form>

            <h2>Checks</h2>
            {checks.length ? (
              <ul className="checks">
                {checks.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="note">No structural problems found.</p>
            )}
            <p className="note">
              Click a step or connector to edit it. Drag from a handle to connect. Delete removes the selection.
            </p>
          </>
        )}
      </aside>
      {code && <Modal title={code.title} text={code.text} onClose={() => setCode(null)} />}

      {showPromptGuide && (
        <div className="scrim" onClick={() => setShowPromptGuide(false)} style={{ zIndex: 100 }}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>How to write a perfect prompt</h2>
            <p style={{ color: "var(--graphite)", fontSize: 15, marginBottom: 24 }}>
              The AI is only as good as the text you give it. To get a thesis-ready diagram, include these 4 elements in your text:
            </p>

            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>1. The Design & Sample</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
                  Mention the exact design and sample size.
                  <br />
                  <em style={{ color: "var(--accent)" }}>
                    e.g., "A cross-sectional survey of 250 students using stratified random sampling..."
                  </em>
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>2. The Instruments</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
                  Specify how data was collected.
                  <br />
                  <em style={{ color: "var(--accent)" }}>e.g., "...using a validated 40-item online questionnaire."</em>
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>3. The Analysis</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
                  Name the statistical tests or qualitative methods.
                  <br />
                  <em style={{ color: "var(--accent)" }}>
                    e.g., "...analyzed using hierarchical multiple regression in SPSS."
                  </em>
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>4. Decision Gates (If applicable)</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
                  Mention any checks, validity tests, or "if/then" scenarios.
                  <br />
                  <em style={{ color: "var(--accent)" }}>
                    e.g., "If the reliability alpha was below 0.7, the questionnaire was revised."
                  </em>
                </p>
              </div>

              <div>
                <h3 style={{ fontSize: 16, fontFamily: "var(--sans)", marginBottom: 4 }}>5. Refining with AI (Surgical Edits)</h3>
                <p style={{ margin: 0, fontSize: 14, color: "var(--graphite)" }}>
                  The <strong>Refine with AI</strong> box is for making specific, surgical changes to a diagram you've already
                  generated. Don't ask it to "make it better"—be precise about the node you want to change.
                  <br />
                  <em style={{ color: "var(--accent)" }}>
                    e.g., "Combine the data collection and analysis steps into one node."
                  </em>
                  <br />
                  <em style={{ color: "var(--accent)" }}>e.g., "Add a decision gate for missing data after the sampling step."</em>
                  <br />
                  <em style={{ color: "var(--accent)" }}>e.g., "Change the start terminator to say 'Project Initiation'."</em>
                </p>
              </div>
            </div>

            <div style={{ background: "var(--wash)", padding: 16, borderRadius: "var(--r)", marginTop: 24 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Pro Tip: Use the PDF Upload</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--graphite)" }}>
                If you already have a written methodology chapter, just click <strong>"Or upload a PDF / DOCX"</strong> below. The
                AI will automatically extract the methodology and build the flowchart for you.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Link
                href="/guide"
                target="_blank"
                className="note"
                style={{ textDecoration: "underline", alignSelf: "center" }}
              >
                Read the full guide →
              </Link>
              <button className="pri" onClick={() => setShowPromptGuide(false)} style={{ marginLeft: "auto" }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal />
    </div>
  );
}

export default function Editor() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
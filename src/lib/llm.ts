import "server-only";
import { IRSchema, METHODS, type IR, type Method } from "./core/ir";
import { sanitizeIR, validateGraph } from "./core/validate";
import { fixTopology } from "./core/postprocess";
import { layout } from "./core/layout";
import {
  systemPrompt,
  REFINE_SYSTEM,
  userMsg,
  repairMsg,
  polishMsg,
  UNDERSTAND_SYSTEM,
  understandMsg,
} from "./core/prompt";
import { qualityIssues } from "./core/quality";
import { focusMethodology } from "./core/extract";
import { fallbackFor } from "./templates";

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** One concrete (provider, model) the pipeline can call. */
type Attempt = {
  id: string; // "provider:model" - the circuit breaker is keyed on this, NOT on the provider
  provider: "deepseek" | "openai";
  url: string;
  key: string;
  model: string;
  thinking: boolean; // reasoning model: no temperature/top_p, needs a much bigger token budget
  maxTokens: number;
  timeoutMs: number;
};

type CallResult = { text: string; finish: string; tin: number; tout: number };

export type Gen = { ir: IR; source: "ai" | "template"; warnings: string[]; cost: number; provider?: string };

const DS_URL = "https://api.deepseek.com/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MIN_CALL_MS = 6_000; // don't start a call with less than this left on the clock

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

/* ------------------------------------------------------------------ */
/* 1. MODEL LADDER                                                     */
/*    deep (Pro):  reasoner -> fast model -> OpenAI                    */
/*    fast (Free): fast model -> OpenAI                                */
/* ------------------------------------------------------------------ */
function attempts(deep: boolean): Attempt[] {
  const dsKey = process.env.DEEPSEEK_API_KEY || "";
  // NOTE: check these names against GET https://api.deepseek.com/models - DeepSeek has been
  // renaming/retiring aliases. Override via env; nothing below depends on the literal names.
  const fast = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const think = process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner";
  const oai = process.env.OPENAI_MODEL || "";

  const list: Attempt[] = [];
  if (deep && think !== fast) {
    list.push({
      id: `deepseek:${think}`,
      provider: "deepseek",
      url: DS_URL,
      key: dsKey,
      model: think,
      thinking: true,
      // Reasoning models spend tokens thinking before they write the JSON. 2500 was far too small.
      maxTokens: num(process.env.DEEPSEEK_REASONER_MAX_TOKENS, 12000),
      timeoutMs: 90_000,
    });
  }
  list.push({ id: `deepseek:${fast}`, provider: "deepseek", url: DS_URL, key: dsKey, model: fast, thinking: false, maxTokens: 3500, timeoutMs: 40_000 });
  list.push({ id: `openai:${oai}`, provider: "openai", url: OPENAI_URL, key: process.env.OPENAI_API_KEY || "", model: oai, thinking: false, maxTokens: 3500, timeoutMs: 40_000 });
  return list.filter((a) => a.key && a.model);
}

/* ------------------------------------------------------------------ */
/* 2. CIRCUIT BREAKER (per provider:model)                             */
/*    A slow reasoner can no longer lock the free-tier model out.      */
/* ------------------------------------------------------------------ */
const brk = new Map<string, { f: number; until: number }>();
const tripped = (id: string) => (brk.get(id)?.until ?? 0) > Date.now();
const fail = (id: string, weight = 1) => {
  const b = brk.get(id) ?? { f: 0, until: 0 };
  b.f += weight;
  if (b.f >= 5) {
    b.until = Date.now() + 3e5;
    b.f = 0;
  }
  brk.set(id, b);
};
const okp = (id: string) => brk.delete(id);

class ApiError extends Error {
  status: number;
  body: string;
  constructor(id: string, status: number, body: string) {
    super(`${id} HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function noteFailure(a: Attempt, e: unknown) {
  const err = e as { name?: string; message?: string };
  const status = e instanceof ApiError ? e.status : 0;
  // Previously failures were swallowed. A dead key, empty balance (402) or retired model (404)
  // looked identical to "AI is unavailable". Now it is in your logs.
  console.error(`[llm] ${a.id} failed:`, status || err?.name, e instanceof ApiError ? e.body : err?.message);
  // auth / balance / model-not-found will not fix themselves in five minutes: trip immediately
  fail(a.id, [401, 402, 403, 404].includes(status) ? 5 : 1);
}

/* ------------------------------------------------------------------ */
/* 3. API CALLER                                                       */
/* ------------------------------------------------------------------ */
async function call(a: Attempt, msgs: Msg[], timeoutMs: number): Promise<CallResult> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), Math.max(1_000, timeoutMs));

  const body: Record<string, unknown> = {
    model: a.model,
    messages: msgs,
    response_format: { type: "json_object" },
  };
  if (a.provider === "openai") body.max_completion_tokens = a.maxTokens;
  else body.max_tokens = a.maxTokens;

  // Reasoning models ignore (DeepSeek) or reject (OpenAI o-series / gpt-5) sampling parameters.
  const openaiReasoner = a.provider === "openai" && /^(o\d|gpt-5)/i.test(a.model);
  if (!a.thinking && !openaiReasoner) {
    body.temperature = 0.2;
    body.top_p = 0.9;
  }

  try {
    const r = await fetch(a.url, {
      method: "POST",
      signal: c.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.key },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new ApiError(a.id, r.status, (await r.text().catch(() => "")).slice(0, 300));
    const j = await r.json();
    const ch = j.choices?.[0];
    return {
      text: String(ch?.message?.content ?? ""), // reasoning_content is intentionally never sent back
      finish: String(ch?.finish_reason ?? ""),
      tin: Number(j.usage?.prompt_tokens ?? 0),
      tout: Number(j.usage?.completion_tokens ?? 0),
    };
  } finally {
    clearTimeout(t);
  }
}

// Per-model pricing: PRICE_IN_PER_M_DEEP / _OPENAI override the shared PRICE_IN_PER_M (same for OUT)
function costOf(a: Attempt, r: CallResult) {
  const sfx = a.thinking ? "_DEEP" : a.provider === "openai" ? "_OPENAI" : "";
  const pin = Number(process.env["PRICE_IN_PER_M" + sfx] ?? process.env.PRICE_IN_PER_M ?? 0);
  const pout = Number(process.env["PRICE_OUT_PER_M" + sfx] ?? process.env.PRICE_OUT_PER_M ?? 0);
  return (r.tin * pin + r.tout * pout) / 1e6;
}

/* ------------------------------------------------------------------ */
/* 4. PARSER                                                           */
/* ------------------------------------------------------------------ */
// Tolerates code fences and stray prose around the object (reasoning models do this).
function jsonOf(t: string): unknown {
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

function parse(t: string): { ir?: IR; issues: string[] } {
  const j = jsonOf(t);
  if (j === null) return { issues: ["Output was not valid JSON."] };
  const r = IRSchema.safeParse(j);
  if (!r.success) return { issues: r.error.issues.slice(0, 6).map((i) => i.path.join(".") + ": " + i.message) };
  const ir = sanitizeIR(r.data);
  return { ir, issues: validateGraph(ir, true) };
}

/* ------------------------------------------------------------------ */
/* 5. SOLVER - shared by generate() and refine()                       */
/*    hard issues  -> repair round (max 1)                             */
/*    soft issues  -> ONE polish round, kept only if it is strictly    */
/*                    better and still valid (Pro only)                */
/* ------------------------------------------------------------------ */
type SolveOpts = {
  deep: boolean;
  system: string;
  user: string;
  deadline: number; // epoch ms; every call is budgeted against this
  soft?: (ir: IR) => string[]; // quality rubric (optional)
  guard?: (ir: IR) => string[]; // extra HARD checks (optional)
};

async function solve(o: SolveOpts): Promise<{ ir?: IR; cost: number; provider?: string; tried: boolean }> {
  let cost = 0;
  let tried = false;

  for (const a of attempts(o.deep)) {
    if (tripped(a.id)) continue;

    const msgs: Msg[] = [
      { role: "system", content: o.system },
      { role: "user", content: o.user },
    ];
    let good: { ir: IR; soft: string[] } | null = null;
    let repairs = 0;
    let polished = false;

    try {
      for (;;) {
        const remaining = o.deadline - Date.now();
        if (remaining < MIN_CALL_MS) break;
        // The reasoner may use at most 60% of what is left, so the fast model still has time to run.
        const timeout = Math.min(a.timeoutMs, a.thinking ? remaining * 0.6 : remaining - 1_000);

        tried = true;
        const r = await call(a, msgs, timeout);
        cost += costOf(a, r);

        const p = parse(r.text);
        const issues = [...p.issues, ...(p.ir && o.guard ? o.guard(p.ir) : [])];
        if (r.finish === "length" && !p.ir) issues.unshift("The output was cut off before the JSON ended. Use fewer, shorter labels.");

        if (p.ir && !issues.length) {
          okp(a.id);
          const soft = o.soft ? o.soft(p.ir) : [];
          if (!good || soft.length < good.soft.length) good = { ir: p.ir, soft };
          if (polished || !soft.length) break;
          polished = true;
          msgs.push({ role: "assistant", content: r.text }, { role: "user", content: polishMsg(soft) });
          continue;
        }

        if (good || ++repairs >= 2) break; // polish broke it, or repair already failed: stop here
        msgs.push({ role: "assistant", content: r.text }, { role: "user", content: repairMsg(issues) });
      }
    } catch (e) {
      if (!good) noteFailure(a, e);
      else console.warn(`[llm] ${a.id} polish pass failed, keeping the valid draft`);
    }

    if (good) return { ir: layout(fixTopology(good.ir)), cost, provider: a.provider, tried };
  }
  return { cost, tried };
}

/* ------------------------------------------------------------------ */
/* 6. GENERATE                                                         */
/* ------------------------------------------------------------------ */
export async function generate(a: {
  method: Method;
  text: string;
  extra: string;
  warnings: string[];
  isPro?: boolean;
  deadline?: number;
}): Promise<Gen> {
  const isPro = !!a.isPro;
  const deadline = a.deadline ?? Date.now() + (isPro ? 105_000 : 40_000);
  const w = [...a.warnings];
  const rich = a.text.trim().length > 400;

  const r = await solve({
    deep: isPro,
    deadline,
    system: systemPrompt(isPro),
    user: userMsg(a.method, a.text, a.extra),
    // Self-improvement pass is a Pro feature (costs one extra call only when the rubric finds problems)
    soft: isPro ? (ir) => qualityIssues(ir, { method: a.method, rich }) : undefined,
  });

  if (r.ir) return { ir: r.ir, source: "ai", warnings: w, cost: r.cost, provider: r.provider };
  return {
    ir: fallbackFor(a.method),
    source: "template",
    warnings: [
      ...w,
      r.tried
        ? "The generator could not produce a valid diagram. Showing the closest template."
        : "AI is unavailable. Showing the closest template.",
    ],
    cost: r.cost,
  };
}

/* ------------------------------------------------------------------ */
/* 7. DOCUMENT PIPELINE (uploads and long Pro text)                    */
/*    focus on the methodology section -> condense to a faithful brief */
/*    (cheap model) -> generate from the brief (best model)            */
/* ------------------------------------------------------------------ */
async function understand(a: { text: string; deadline: number }): Promise<{ method: Method | null; brief: string | null; cost: number }> {
  let cost = 0;
  for (const at of attempts(false)) {
    if (tripped(at.id)) continue;
    const remaining = a.deadline - Date.now();
    if (remaining < 25_000) break; // keep the clock for the generation step
    try {
      const r = await call(
        at,
        [
          { role: "system", content: UNDERSTAND_SYSTEM },
          { role: "user", content: understandMsg(a.text) },
        ],
        Math.min(30_000, remaining * 0.25)
      );
      cost += costOf(at, r);
      okp(at.id);
      const j = jsonOf(r.text) as { methodology?: unknown; brief?: unknown } | null;
      const brief = typeof j?.brief === "string" ? j.brief.trim() : "";
      const m =
        typeof j?.methodology === "string" && (METHODS as readonly string[]).includes(j.methodology)
          ? (j.methodology as Method)
          : null;
      return { method: m, brief: brief.length >= 150 ? brief : null, cost };
    } catch (e) {
      noteFailure(at, e);
    }
  }
  return { method: null, brief: null, cost };
}

export async function generateFromDocument(a: {
  text: string;
  isPro: boolean;
  method?: Method; // omit to auto-detect
  extra?: string;
  warnings: string[];
  deadline?: number;
}): Promise<Gen> {
  const deadline = a.deadline ?? Date.now() + 105_000;
  const w = [...a.warnings];

  const focus = focusMethodology(a.text);
  if (focus.mode === "section") w.push("Long document: the methodology section was located and used.");
  if (focus.mode === "keywords") {
    w.push("Long document: no clear methodology chapter was found, so the most method-heavy passages were used. Check the result against your document.");
  }

  const u = await understand({ text: focus.text, deadline });
  const g = await generate({
    method: a.method ?? u.method ?? "custom",
    text: u.brief ?? focus.text, // if condensing failed, fall back to the focused raw text
    extra: a.extra ?? "Generated from uploaded document.",
    warnings: w,
    isPro: a.isPro,
    deadline,
  });
  return { ...g, cost: g.cost + u.cost };
}

/* ------------------------------------------------------------------ */
/* 8. REFINE                                                           */
/*    Fast model by default (interactive edits shouldn't take a        */
/*    minute); pass deep: true to let Pro use the reasoner.            */
/*    Guard: reject rewrites that silently delete existing nodes.      */
/* ------------------------------------------------------------------ */
function preservationGuard(before: IR, instruction: string) {
  const removalIntent = /\b(remov\w*|delet\w*|drop|simplif\w*|merg\w*|combin\w*|condens\w*|shorten|reduc\w*|trim|cut|replace|rewrite|restructur\w*|start over|redo)\b/i.test(instruction);
  const ids = before.nodes.map((n) => n.id);
  return (after: IR): string[] => {
    if (removalIntent) return [];
    const have = new Set(after.nodes.map((n) => n.id));
    const lost = ids.filter((id) => !have.has(id));
    return lost.length
      ? [`You deleted existing nodes (${lost.slice(0, 6).join(", ")}). The instruction did not ask for removal; restore them with the same ids.`]
      : [];
  };
}

export async function refine(a: { ir: IR; instruction: string; isPro?: boolean; deep?: boolean; deadline?: number }): Promise<Gen> {
  const deep = !!(a.isPro && a.deep);
  const deadline = a.deadline ?? Date.now() + (deep ? 105_000 : 40_000);

  // Strip layout coordinates (if your layout writes them onto the IR): they bloat the prompt and tempt the model to edit them.
  const currentJson = JSON.stringify(a.ir, (k, v) => (k === "x" || k === "y" ? undefined : v));
  const instruction = a.instruction.replace(/<\/?\s*instruction\s*>/gi, "");

  const r = await solve({
    deep,
    deadline,
    system: REFINE_SYSTEM,
    user: `Current JSON:\n${currentJson}\n\n<instruction>\n${instruction}\n</instruction>`,
    guard: preservationGuard(a.ir, a.instruction),
  });

  if (r.ir) return { ir: r.ir, source: "ai", warnings: [], cost: r.cost, provider: r.provider };
  return {
    ir: a.ir,
    source: "template",
    warnings: [r.tried ? "The AI could not complete the refinement. Your diagram is unchanged." : "AI is unavailable."],
    cost: r.cost,
  };
}
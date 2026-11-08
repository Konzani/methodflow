import "server-only";
import { IRSchema, METHODS, type IR, type Method, type RequestMethod } from "./core/ir";
import { sanitizeIR, validateGraph } from "./core/validate";
import { fixTopology, labelDecisionBranches } from "./core/postprocess";
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
import { qualityIssues, numberFidelity } from "./core/quality";
import { focusMethodology } from "./core/extract";
import { fallbackFor } from "./templates";
import { attempts, legacyModelEnv, requestBody, type Attempt } from "./models";

type Msg = { role: "system" | "user" | "assistant"; content: string };

type CallResult = { text: string; finish: string; tin: number; tout: number };

export type Gen = { ir: IR; source: "ai" | "template"; warnings: string[]; cost: number; provider?: string };

const MIN_CALL_MS = 6_000;

for (const name of legacyModelEnv()) {
  console.error(`[llm] ${name} holds a retired DeepSeek model name; it is remapped to the current default. Update the environment variable.`);
}

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
  console.error(`[llm] ${a.id} failed:`, status || err?.name, e instanceof ApiError ? e.body : err?.message);
  fail(a.id, [401, 402, 403, 404].includes(status) ? 5 : 1);
}

async function call(a: Attempt, msgs: Msg[], timeoutMs: number): Promise<CallResult> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), Math.max(1_000, timeoutMs));
  try {
    const r = await fetch(a.url, {
      method: "POST",
      signal: c.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + a.key },
      body: JSON.stringify(requestBody(a, msgs)),
    });
    if (!r.ok) throw new ApiError(a.id, r.status, (await r.text().catch(() => "")).slice(0, 300));
    const j = await r.json();
    const ch = j.choices?.[0];
    return {
      text: String(ch?.message?.content ?? ""),
      finish: String(ch?.finish_reason ?? ""),
      tin: Number(j.usage?.prompt_tokens ?? 0),
      tout: Number(j.usage?.completion_tokens ?? 0),
    };
  } finally {
    clearTimeout(t);
  }
}

let priceWarned = false;
function costOf(a: Attempt, r: CallResult) {
  const sfx = a.thinking ? "_DEEP" : a.provider === "openai" ? "_OPENAI" : "";
  if (sfx === "_DEEP" && process.env.PRICE_IN_PER_M_DEEP === undefined && !priceWarned) {
    priceWarned = true;
    console.error("[llm] PRICE_IN_PER_M_DEEP / PRICE_OUT_PER_M_DEEP are not set: deep-model spend is estimated with the fast-model prices and the daily budget guard will under-count.");
  }
  const pin = Number(process.env["PRICE_IN_PER_M" + sfx] ?? process.env.PRICE_IN_PER_M ?? 0);
  const pout = Number(process.env["PRICE_OUT_PER_M" + sfx] ?? process.env.PRICE_OUT_PER_M ?? 0);
  return (r.tin * pin + r.tout * pout) / 1e6;
}

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
  const ir = labelDecisionBranches(sanitizeIR(r.data));
  return { ir, issues: validateGraph(ir, true) };
}

type SolveOpts = {
  deep: boolean;
  system: string;
  user: string;
  deadline: number;
  soft?: (ir: IR) => string[];
  guard?: (ir: IR) => string[];
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

        if (good || ++repairs >= 2) break;
        msgs.push({ role: "assistant", content: r.text }, { role: "user", content: repairMsg(issues) });
      }
    } catch (e) {
      if (!good) noteFailure(a, e);
      else console.error(`[llm] ${a.id} polish pass failed, keeping the valid draft`);
    }

    if (good) return { ir: layout(fixTopology(good.ir)), cost, provider: a.provider, tried };
  }
  return { cost, tried };
}

const list = (xs: string[]) => xs.slice(0, 6).join(", ");

export async function generate(a: {
  method: RequestMethod;
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
  const source = `${a.text}\n${a.extra}`;
  const methodOf = (ir: IR): string => (a.method === "auto" ? ir.meta.methodology : a.method);

  const r = await solve({
    deep: isPro,
    deadline,
    system: systemPrompt(isPro),
    user: userMsg(a.method, a.text, a.extra),
    soft: isPro ? (ir) => qualityIssues(ir, { method: methodOf(ir), rich, source }) : undefined,
  });

  if (r.ir) {
    if (a.text.trim().length >= 40) {
      const f = numberFidelity(r.ir, source);
      if (f.invented.length) w.push(`Numbers in the diagram that are not in your text: ${list(f.invented)}. Remove them unless you added them yourself.`);
      if (f.missing.length) w.push(`Numbers from your text that are not in the diagram: ${list(f.missing)}. Add them to the relevant step.`);
    }
    return { ir: r.ir, source: "ai", warnings: w, cost: r.cost, provider: r.provider };
  }
  return {
    ir: fallbackFor(a.method === "auto" ? "custom" : a.method),
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

async function understand(a: { text: string; deadline: number }): Promise<{ method: Method | null; brief: string | null; cost: number }> {
  let cost = 0;
  for (const at of attempts(false)) {
    if (tripped(at.id)) continue;
    const remaining = a.deadline - Date.now();
    if (remaining < 25_000) break;
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
  method?: RequestMethod;
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
  const explicit = a.method && a.method !== "auto" ? a.method : null;
  const g = await generate({
    method: explicit ?? u.method ?? "custom",
    text: u.brief ?? focus.text,
    extra: a.extra ?? "Generated from uploaded document.",
    warnings: w,
    isPro: a.isPro,
    deadline,
  });
  return { ...g, cost: g.cost + u.cost };
}

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

const LAYOUT_KEYS = new Set(["x", "y", "w", "h", "points", "labelPos", "canvas", "pinned"]);

export async function refine(a: { ir: IR; instruction: string; isPro?: boolean; deep?: boolean; deadline?: number }): Promise<Gen> {
  const deep = !!(a.isPro && a.deep);
  const deadline = a.deadline ?? Date.now() + (deep ? 105_000 : 40_000);

  const currentJson = JSON.stringify(a.ir, (k, v) => (LAYOUT_KEYS.has(k) ? undefined : v));
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

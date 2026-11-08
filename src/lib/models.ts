export type Attempt = {
  id: string;
  provider: "deepseek" | "openai";
  url: string;
  key: string;
  model: string;
  thinking: boolean;
  effort?: "high" | "max";
  maxTokens: number;
  timeoutMs: number;
};

type Env = Record<string, string | undefined>;

export const DS_URL = "https://api.deepseek.com/chat/completions";
export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const DEFAULT_FAST_MODEL = "deepseek-flash";
export const DEFAULT_DEEP_MODEL = "deepseek-v4-pro";

const LEGACY = /^deepseek-(chat|reasoner)$/i;

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function normalizeModel(name: string | undefined, role: "fast" | "deep"): { model: string; remapped: boolean } {
  const fallback = role === "fast" ? DEFAULT_FAST_MODEL : DEFAULT_DEEP_MODEL;
  const n = (name ?? "").trim();
  if (!n) return { model: fallback, remapped: false };
  if (LEGACY.test(n)) return { model: fallback, remapped: true };
  return { model: n, remapped: false };
}

export function legacyModelEnv(env: Env = process.env): string[] {
  const out: string[] = [];
  if (LEGACY.test((env.DEEPSEEK_MODEL ?? "").trim())) out.push("DEEPSEEK_MODEL");
  if (LEGACY.test((env.DEEPSEEK_DEEP_MODEL ?? "").trim())) out.push("DEEPSEEK_DEEP_MODEL");
  if (LEGACY.test((env.DEEPSEEK_REASONER_MODEL ?? "").trim())) out.push("DEEPSEEK_REASONER_MODEL");
  return out;
}

export function attempts(deep: boolean, env: Env = process.env): Attempt[] {
  const key = env.DEEPSEEK_API_KEY || "";
  const fast = normalizeModel(env.DEEPSEEK_MODEL, "fast").model;
  const deepModel = normalizeModel(env.DEEPSEEK_DEEP_MODEL || env.DEEPSEEK_REASONER_MODEL, "deep").model;
  const effort = env.DEEPSEEK_DEEP_EFFORT === "max" ? "max" : "high";
  const oai = env.OPENAI_MODEL || "";

  const list: Attempt[] = [];
  if (deep) {
    list.push({
      id: `deepseek:${deepModel}:think`,
      provider: "deepseek",
      url: DS_URL,
      key,
      model: deepModel,
      thinking: true,
      effort,
      maxTokens: num(env.DEEPSEEK_DEEP_MAX_TOKENS || env.DEEPSEEK_REASONER_MAX_TOKENS, 16000),
      timeoutMs: 90_000,
    });
  }
  list.push({
    id: `deepseek:${fast}`,
    provider: "deepseek",
    url: DS_URL,
    key,
    model: fast,
    thinking: false,
    maxTokens: 4500,
    timeoutMs: 40_000,
  });
  list.push({
    id: `openai:${oai}`,
    provider: "openai",
    url: OPENAI_URL,
    key: env.OPENAI_API_KEY || "",
    model: oai,
    thinking: false,
    maxTokens: 4500,
    timeoutMs: 40_000,
  });
  return list.filter((a) => a.key && a.model);
}

export function requestBody(a: Attempt, messages: { role: string; content: string }[]): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: a.model,
    messages,
    response_format: { type: "json_object" },
  };
  if (a.provider === "openai") {
    body.max_completion_tokens = a.maxTokens;
    if (!/^(o\d|gpt-5)/i.test(a.model)) {
      body.temperature = 0.2;
      body.top_p = 0.9;
    }
    return body;
  }
  body.max_tokens = a.maxTokens;
  body.thinking = { type: a.thinking ? "enabled" : "disabled" };
  if (a.thinking) body.reasoning_effort = a.effort ?? "high";
  else body.temperature = 0.2;
  return body;
}

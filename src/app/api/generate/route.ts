import { NextRequest } from "next/server";
import { z } from "zod";
import { METHODS } from "@/lib/core/ir";
import { cleanText } from "@/lib/core/sanitize";
import { generate, generateFromDocument } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const FREE_CHARS = 8000;
const PRO_CHARS = 20000; 
const PRO_DAILY_CAP = 200; 

const B = z.object({
  methodology: z.enum(METHODS),
  text: z.string().max(PRO_CHARS).optional(),
  extra: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > PRO_CHARS + 4000) return fail("TOO_LARGE", 413);
    const p = B.safeParse(JSON.parse(raw));
    if (!p.success) return fail("BAD_REQUEST", 400);

    // 1. Check Auth & Plan
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let isPro = false;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      isPro = profile?.plan === "pro";
    }

    // 2. Rate limits: strict for Free, fair-use for Pro
    if (!isPro) {
      const limitKey = user ? user.id : ipOf(req.headers);
      if (!(await limit("gen_free", limitKey, undefined, 3, "1 d"))) return fail("RATE_LIMITED", 429);
    } else if (user && !(await limit("gen_pro", user.id, undefined, PRO_DAILY_CAP, "1 d"))) {
      return fail("RATE_LIMITED", 429);
    }

    if (!(await budgetOk())) return fail("BUDGET", 503);

    const t = cleanText(p.data.text, isPro ? PRO_CHARS : FREE_CHARS);
    const x = cleanText(p.data.extra, 300);
    const warnings = [...t.warnings, ...x.warnings];
    const deadline = Date.now() + (isPro ? 105_000 : 40_000);

    // 3. Pro + long text: condense to a faithful brief first, then generate from the brief
    const g =
      isPro && t.text.length > 3000
        ? await generateFromDocument({ text: t.text, isPro, method: p.data.methodology, extra: x.text, warnings, deadline })
        : await generate({ method: p.data.methodology, text: t.text, extra: x.text, warnings, isPro, deadline });

    await spend(g.cost);
    return ok({ ir: g.ir, source: g.source, warnings: g.warnings });
  } catch (e) {
    if (e instanceof SyntaxError) return fail("BAD_REQUEST", 400);
    console.error("Generate route fatal error:", e);
    return fail("SERVER", 500);
  }
}
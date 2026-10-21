import { NextRequest } from "next/server";
import { z } from "zod";
import { METHODS } from "@/lib/core/ir";
import { cleanText } from "@/lib/core/sanitize";
import { generate } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const B = z.object({ methodology: z.enum(METHODS), text: z.string().max(8000).optional(), extra: z.string().max(300).optional() });

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 20000) return fail("TOO_LARGE", 413);
    const p = B.safeParse(JSON.parse(raw));
    if (!p.success) return fail("BAD_REQUEST", 400);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let isPro = false;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      isPro = profile?.plan === "pro";
    }

    if (!isPro) {
      const limitKey = user ? user.id : ipOf(req.headers);
      if (!await limit("gen_free", limitKey, undefined, 3, "1 d")) {
        return fail("RATE_LIMITED", 429);
      }
    }

    if (!await budgetOk()) return fail("BUDGET", 503);

    const t = cleanText(p.data.text);
    const x = cleanText(p.data.extra, 300);
    
    const g = await generate({ 
      method: p.data.methodology, 
      text: t.text, 
      extra: x.text, 
      warnings: [...t.warnings, ...x.warnings],
      isPro
    });
    
    await spend(g.cost);
    return ok({ ir: g.ir, source: g.source, warnings: g.warnings });
  } catch (e) {
    if (e instanceof SyntaxError) return fail("BAD_REQUEST", 400);
    return fail("SERVER", 500);
  }
}
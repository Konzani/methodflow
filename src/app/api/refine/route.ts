import { NextRequest } from "next/server";
import { z } from "zod";
import { IRSchema } from "@/lib/core/ir";
import { cleanText } from "@/lib/core/sanitize";
import { refine } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const B = z.object({
  ir: IRSchema,
  instruction: z.string().max(500).min(1)
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 200000) return fail("TOO_LARGE", 413);
    
    const p = B.safeParse(JSON.parse(raw));
    if (!p.success) return fail("BAD_REQUEST", 400);
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let isPro = false;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
      isPro = profile?.plan === "pro";
    }

    const key = user ? user.id : req.cookies.get("mf_id")?.value ?? ipOf(req.headers);
    if (!(await limit(isPro ? "refine_pro" : "refine_free", key, undefined, isPro ? 150 : 10, "1 d"))) return fail("RATE_LIMITED", 429);
    if (!await budgetOk()) return fail("BUDGET", 503);

    const t = cleanText(p.data.instruction, 500);
    const g = await refine({ ir: p.data.ir, instruction: t.text, isPro });
    
    await spend(g.cost);
    return ok({ ir: g.ir, source: g.source, warnings: [...t.warnings, ...g.warnings] });
  } catch (e) {
    if (e instanceof SyntaxError) return fail("BAD_REQUEST", 400);
    return fail("SERVER", 500);
  }
}
import { NextRequest } from "next/server";
import { z } from "zod";
import { IRSchema } from "@/lib/core/ir";
import { cleanText } from "@/lib/core/sanitize";
import { refine } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";

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
    
    if (!await limit("gen", ipOf(req.headers), req.cookies.get("mf_id")?.value)) return fail("RATE_LIMITED", 429);
    if (!await budgetOk()) return fail("BUDGET", 503);
    
    const t = cleanText(p.data.instruction, 500);
    const g = await refine({ ir: p.data.ir, instruction: t.text });
    
    await spend(g.cost);
    return ok({ ir: g.ir, warnings: [...t.warnings, ...g.warnings] });
  } catch (e) {
    if (e instanceof SyntaxError) return fail("BAD_REQUEST", 400);
    return fail("SERVER", 500);
  }
}
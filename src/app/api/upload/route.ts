import { NextRequest } from "next/server";
import { generateFromDocument } from "@/lib/llm";
import { cleanDocument } from "@/lib/core/extract";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";
import { extractText, getDocumentProxy } from "unpdf";
// @ts-ignore
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 120;

const UPLOAD_DAILY_CAP = 40; // fair-use ceiling for Pro uploads; tune freely

export async function POST(req: NextRequest) {
  try {
    if (!(await limit("gen", ipOf(req.headers), req.cookies.get("mf_id")?.value))) {
      return fail("RATE_LIMITED", 429);
    }
    if (!(await budgetOk())) return fail("BUDGET", 503);

    // 1. Pro user check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("BAD_REQUEST", 401);

    const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "pro") return fail("BAD_REQUEST", 403);

    if (!(await limit("upload_pro", user.id, undefined, UPLOAD_DAILY_CAP, "1 d"))) {
      return fail("RATE_LIMITED", 429);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return fail("BAD_REQUEST", 400);
    if (file.size > 4 * 1024 * 1024) return fail("TOO_LARGE", 413); // 4MB limit

    const name = file.name.toLowerCase();
    const buffer = new Uint8Array(await file.arrayBuffer());
    
    // file.type and file.name are client-controlled: confirm by magic bytes
    const isPdf = (name.endsWith(".pdf") || file.type === "application/pdf") && String.fromCharCode(...buffer.slice(0, 5)) === "%PDF-";
    const isDocx =
      (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b; // "PK" zip header
    const isTxt = name.endsWith(".txt") || file.type === "text/plain";

    let text = "";
    try {
      if (isPdf) {
        const pdf = await getDocumentProxy(buffer);
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } else if (isDocx) {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        text = result.value;
      } else if (isTxt) {
        text = Buffer.from(buffer).toString("utf-8");
      } else {
        return fail("BAD_REQUEST", 400);
      }
    } catch (parseError) {
      console.error("File parsing failed:", parseError);
      return fail("BAD_REQUEST", 400); // unreadable/corrupt file is the user's input, not a server fault
    }

    text = cleanDocument(text);
    if (text.length > 600_000) text = text.slice(0, 600_000); 
    if (text.length < 500) return fail("BAD_REQUEST", 400); 

    const g = await generateFromDocument({
      text,
      isPro: true,
      warnings: [],
      deadline: Date.now() + 105_000,
    });

    await spend(g.cost);
    return ok({ ir: g.ir, source: g.source, warnings: g.warnings, reason: g.reason, code: g.code });
  } catch (e) {
    console.error("Upload route fatal error:", e);
    return fail("SERVER", 500);
  }
}
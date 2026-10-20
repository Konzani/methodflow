import { NextRequest } from "next/server";
import { IRSchema, METHODS } from "@/lib/core/ir";
import { generate } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";
import { extractText, getDocumentProxy } from "unpdf";
// @ts-ignore
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    if (!await limit("gen", ipOf(req.headers), req.cookies.get("mf_id")?.value)) {
      return fail("RATE_LIMITED", 429);
    }
    if (!await budgetOk()) return fail("BUDGET", 503);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return fail("BAD_REQUEST", 400);
    if (file.size > 4 * 1024 * 1024) return fail("TOO_LARGE", 413); // 4MB limit for Vercel

    let text = "";
    const buffer = new Uint8Array(await file.arrayBuffer());

    try {
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const pdf = await getDocumentProxy(buffer);
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        text = result.value;
      } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        text = Buffer.from(buffer).toString("utf-8");
      } else {
        return fail("BAD_REQUEST", 400);
      }
    } catch (parseError) {
      console.error("File parsing failed:", parseError);
      return fail("SERVER", 500); 
    }

    // Clean the text
    text = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/\.{4,}\s*\d+/g, "")
      .replace(/^\s*\d+\s*$/gm, "")
      .replace(/\f/g, "")
      .trim();

    if (text.length > 25000) {
      text = text.slice(0, 25000) + "\n[Text truncated due to length...]";
    }
    
    // Ensure we have enough text to generate a flowchart
    if (text.length < 500) {
      return fail("BAD_REQUEST", 400); 
    }

    const g = await generate({
      method: "custom",
      text,
      extra: "Generated from uploaded document.",
      warnings: [],
    });

    await spend(g.cost);
    return ok({ ir: g.ir, warnings: g.warnings });

  } catch (e) {
    console.error("Upload route fatal error:", e);
    return fail("SERVER", 500);
  }
}
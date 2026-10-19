import { NextRequest } from "next/server";
import { z } from "zod";
import { IRSchema, METHODS } from "@/lib/core/ir";
import { generate } from "@/lib/llm";
import { budgetOk, ipOf, limit, spend } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 45;

// Use require to bypass ESM default export issues with pdf-parse in Next.js
// @ts-ignore
const pdf = require("pdf-parse");
// @ts-ignore
const mammoth = require("mammoth");

const B = z.object({
  methodology: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!await limit("gen", ipOf(req.headers), req.cookies.get("mf_id")?.value)) {
      return fail("RATE_LIMITED", 429);
    }
    if (!await budgetOk()) return fail("BUDGET", 503);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const method = formData.get("methodology") as string || "custom";

    if (!file) return fail("BAD_REQUEST", 400);
    if (file.size > 5 * 1024 * 1024) return fail("TOO_LARGE", 413);

    let text = "";
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return fail("BAD_REQUEST", 400);
    }

    text = text.replace(/\s+/g, " ").trim();
    if (text.length > 25000) {
      text = text.slice(0, 25000) + "\n[Text truncated due to length...]";
    }
    if (text.length < 50) return fail("BAD_REQUEST", 400);

    const g = await generate({
      method: (METHODS.includes(method as any) ? method : "custom") as any,
      text,
      extra: "Generated from uploaded document.",
      warnings: [],
    });

    await spend(g.cost);
    return ok({ ir: g.ir, warnings: g.warnings });

  } catch (e) {
    console.error("Upload error:", e);
    return fail("SERVER", 500);
  }
}
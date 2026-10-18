import { NextRequest } from "next/server";
import { z } from "zod";
import { ipOf, limit } from "@/lib/ratelimit";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

const B = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(10).max(5000),
  honeypot: z.string().max(0).optional(), // Hidden field for bots
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 10000) return fail("TOO_LARGE", 413);

    const p = B.safeParse(JSON.parse(raw));
    if (!p.success) return fail("BAD_REQUEST", 400);

    // 1. Honeypot check (if filled, silently succeed but don't send)
    if (p.data.honeypot) return ok({ success: true });

    // 2. Rate limit (max 3 messages per hour per IP)
    const ip = ipOf(req.headers);
    if (!await limit("share", ip)) return fail("RATE_LIMITED", 429);

    // 3. Send via Resend API
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("Missing RESEND_API_KEY");
      return fail("SERVER", 500);
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "MethodFlow Contact <contact@methodflow.geodesia.online>",
        to: "methodflow@geodesia.online",
        subject: `New message from ${p.data.name}`,
        reply_to: p.data.email,
        html: `
          <h2>New Contact Form Message</h2>
          <p><strong>Name:</strong> ${p.data.name}</p>
          <p><strong>Email:</strong> ${p.data.email}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${p.data.message}</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend error:", await emailRes.text());
      return fail("SERVER", 500);
    }

    return ok({ success: true });
  } catch (e) {
    return fail("SERVER", 500);
  }
}
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { LIFECYCLE_EVENTS, planFor } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const rawBody = await req.text();
  const header = req.headers.get("x-signature");
  if (!header) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const digest = Buffer.from(crypto.createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(header, "utf8");
  if (digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const eventName: string | undefined = payload?.meta?.event_name;
  const attributes = payload?.data?.attributes;
  const userId: string | undefined = payload?.meta?.custom_data?.user_id;

  if (!eventName || !LIFECYCLE_EVENTS.has(eventName)) return NextResponse.json({ received: true, ignored: true });
  if (!userId || !attributes) return NextResponse.json({ error: "No user ID" }, { status: 400 });

  const plan = eventName === "subscription_expired" ? "free" : planFor(attributes.status, attributes.ends_at, Date.now());

  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id");

  if (error) {
    console.error("Supabase update error:", error);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }
  if (!data || data.length === 0) {
    console.error("Webhook matched no profile for user", userId);
    return NextResponse.json({ error: "Profile not found" }, { status: 500 });
  }

  return NextResponse.json({ received: true, plan });
}

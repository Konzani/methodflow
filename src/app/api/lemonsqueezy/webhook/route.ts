import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const rawBody = await req.text();
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(req.headers.get("X-Signature") as string, "utf8");

  if (!signature || digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload.meta.event_name;
  const attributes = payload.data.attributes;
  const userId = payload.meta.custom_data?.user_id;

  if (!userId) {
    return NextResponse.json({ error: "No user ID" }, { status: 400 });
  }

  // CRITICAL FIX: Ignore events that aren't about the subscription lifecycle
  if (
    eventName !== "subscription_created" && 
    eventName !== "subscription_updated" && 
    eventName !== "subscription_cancelled" && 
    eventName !== "subscription_resumed" &&
    eventName !== "subscription_expired"
  ) {
    // If it's an order receipt or payment success, just acknowledge it and do nothing.
    return NextResponse.json({ received: true, ignored: true });
  }

  // Map the Lemon Squeezy status directly to your app's plan
  let plan = "free";
  if (
    attributes.status === "active" || 
    attributes.status === "on_trial" || 
    attributes.status === "paid"
  ) {
    plan = "pro";
  }

  // Update the database
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ 
      plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Supabase update error:", error);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
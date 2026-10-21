import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// We use the service role key here to bypass RLS and securely update the user's plan
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const rawBody = await req.text(); // Must use raw body for signature verification
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
  const signature = Buffer.from(req.headers.get("X-Signature") as string, "utf8");

  // 1. Verify the signature
  if (!signature || digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = payload.meta.event_name;
  const attributes = payload.data.attributes;
  const userId = payload.meta.custom_data?.user_id;

  if (!userId) {
    return NextResponse.json({ error: "No user ID in custom_data" }, { status: 400 });
  }

  // 2. Handle subscription status changes
  let plan = "free";
  
  if (
    eventName === "subscription_created" || 
    eventName === "subscription_resumed" || 
    eventName === "subscription_updated"
  ) {
    // If the subscription is active or on trial, they get Pro
    if (attributes.status === "active" || attributes.status === "on_trial") {
      plan = "pro";
    }
  } else if (eventName === "subscription_cancelled" || eventName === "subscription_expired") {
    plan = "free";
  }

  // 3. Update the user's plan in Supabase
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
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

// ==========================================
// DIAGNOSTIC GET ROUTE
// Visit: https://methodflow.geodesia.online/api/lemonsqueezy/checkout
// ==========================================
export async function GET() {
  return Response.json({
    hasApiKey: !!process.env.LEMONSQUEEZY_API_KEY,
    hasStoreId: !!process.env.LEMONSQUEEZY_STORE_ID,
    hasMonthlyId: !!process.env.LEMONSQUEEZY_VARIANT_MONTHLY,
    hasHalfYearlyId: !!process.env.LEMONSQUEEZY_VARIANT_HALF_YEARLY,
    hasYearlyId: !!process.env.LEMONSQUEEZY_VARIANT_YEARLY,
    storeIdValue: process.env.LEMONSQUEEZY_STORE_ID || "MISSING",
    monthlyIdValue: process.env.LEMONSQUEEZY_VARIANT_MONTHLY || "MISSING",
  });
}

// ==========================================
// CHECKOUT POST ROUTE
// ==========================================
export async function POST(req: NextRequest) {
  try {
    // 1. Verify environment variables exist before setting up the SDK
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey) {
      console.error("[LS CHECKOUT] Missing LEMONSQUEEZY_API_KEY");
      return fail("SERVER", 500);
    }
    if (!storeId) {
      console.error("[LS CHECKOUT] Missing LEMONSQUEEZY_STORE_ID");
      return fail("SERVER", 500);
    }

    // 2. Initialize SDK safely inside the handler
    lemonSqueezySetup({ apiKey });

    const { plan } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error("[LS CHECKOUT] No user session found");
      return ok({ redirect: "/login?next=/pricing" });
    }

    // 3. Determine the Variant ID based on the plan
    let variantId = "";
    if (plan === "monthly") variantId = process.env.LEMONSQUEEZY_VARIANT_MONTHLY || "";
    else if (plan === "half-yearly") variantId = process.env.LEMONSQUEEZY_VARIANT_HALF_YEARLY || "";
    else if (plan === "yearly") variantId = process.env.LEMONSQUEEZY_VARIANT_YEARLY || "";

    if (!variantId) {
      console.error(`[LS CHECKOUT] Missing Variant ID for plan: ${plan}`);
      return fail("SERVER", 500);
    }

    console.log(`[LS CHECKOUT] Creating checkout for plan: ${plan}, variant: ${variantId}, store: ${storeId}`);

    // 4. Create the Lemon Squeezy Checkout Session
    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: user.email,
        custom: { user_id: user.id },
      },
      productOptions: {
        redirectUrl: `${req.nextUrl.origin}/dashboard?upgraded=true`,
      },
    });

    // 5. Validate response
    if (!checkout.data?.data.attributes.url) {
      console.error("[LS CHECKOUT] No checkout URL in response", checkout);
      throw new Error("No checkout URL returned");
    }

    return ok({ url: checkout.data.data.attributes.url });
  } catch (e: any) {
    // 6. Log exact fatal error for Vercel
    console.error("[LS CHECKOUT] Fatal error:", e?.message || e);
    return fail("SERVER", 500);
  }
}
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // If user is not logged in, tell the frontend to redirect to login
    if (!user) {
      return ok({ redirect: "/login?next=/pricing" });
    }

    let variantId = "";
    if (plan === "monthly") variantId = process.env.LEMONSQUEEZY_VARIANT_MONTHLY!;
    else if (plan === "half-yearly") variantId = process.env.LEMONSQUEEZY_VARIANT_HALF_YEARLY!;
    else if (plan === "yearly") variantId = process.env.LEMONSQUEEZY_VARIANT_YEARLY!;

    if (!variantId) {
      console.error("Missing Variant ID for plan:", plan);
      return fail("SERVER", 500);
    }

    const checkout = await createCheckout(
      process.env.LEMONSQUEEZY_STORE_ID!,
      variantId,
      {
        checkoutData: {
          email: user.email,
          custom: { user_id: user.id },
        },
        productOptions: {
          redirectUrl: `${req.nextUrl.origin}/dashboard?upgraded=true`,
        },
      }
    );

    if (!checkout.data?.data.attributes.url) throw new Error("No checkout URL");

    return ok({ url: checkout.data.data.attributes.url });
  } catch (e: any) {
    console.error("Lemon Squeezy checkout error:", e);
    return fail("SERVER", 500);
  }
}
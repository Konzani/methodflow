import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use the Service Role Key to bypass RLS and delete the user
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Note: If they are a Pro user, you might want to cancel their Lemon Squeezy 
    // subscription via their API here BEFORE deleting the account to prevent future charges.

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
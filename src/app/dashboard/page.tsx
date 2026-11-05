import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";
import { DeleteAccountButton } from "@/components/DeleteAccountButton";

export const metadata = {
  title: "Dashboard | MethodFlow",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: diagrams } = await supabase
    .from("diagrams")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const isUpgraded = (await searchParams).upgraded === "true";

  return (
    <>
      <Header />
      <main className="wrap page" style={{ minHeight: "60vh" }}>
        
        {/* Success Banner */}
        {isUpgraded && (
          <div style={{ background: "#E4F1E9", border: "1px solid #2E6B45", color: "#2E6B45", padding: 16, borderRadius: 8, marginBottom: 32, textAlign: "center", fontWeight: 600 }}>
            🎉 Payment successful! Welcome to MethodFlow Pro. Your account has been upgraded.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24, marginBottom: 48 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Your Workspace</h1>
            <p style={{ margin: 0, fontSize: 16 }}>
              Signed in as <strong>{user.email}</strong>
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>
              Plan: <span style={{ background: profile?.plan === "pro" ? "#E4F1E9" : "var(--wash)", color: profile?.plan === "pro" ? "#2E6B45" : "var(--slate)", padding: "2px 8px", borderRadius: 4, fontWeight: 600, textTransform: "capitalize" }}>{profile?.plan || "Free"} Tier</span>
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 12 }}>
            {profile?.plan !== "pro" && (
              <Link href="/pricing" className="btn ghost" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                Upgrade to Pro
              </Link>
            )}
            <Link href="/app" className="btn">+ New Flowchart</Link>
          </div>
        </div>

        {/* Diagrams Grid */}
        <h2 style={{ fontSize: 24, marginBottom: 20 }}>Cloud Diagrams</h2>
        
        {(!diagrams || diagrams.length === 0) ? (
          <div className="plate" style={{ padding: "64px 24px", textAlign: "center", background: "var(--wash)", borderStyle: "dashed" }}>
            <h3 style={{ fontSize: 20, marginBottom: 12 }}>No diagrams saved to the cloud yet</h3>
            <p style={{ marginBottom: 24, color: "var(--graphite)" }}>
              Open the editor to generate a flowchart, then click "Save to Cloud" to see it here.
            </p>
            <Link href="/app" className="btn">Open the Editor</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {diagrams.map((d) => (
              <div key={d.id} className="plate" style={{ padding: 20, display: "flex", flexDirection: "column", background: "#fff" }}>
                <h3 style={{ fontSize: 18, marginBottom: 8, flex: 1 }}>{d.title}</h3>
                <p style={{ fontSize: 13, color: "var(--slate)", marginBottom: 16 }}>
                  Updated {new Date(d.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <Link href={`/app?id=${d.id}`} className="btn" style={{ textAlign: "center", padding: "8px" }}>
                  Open Diagram
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Danger Zone */}
        <div style={{ marginTop: 96, borderTop: "1px solid var(--line)", paddingTop: 32 }}>
          <h2 style={{ fontSize: 20, color: "var(--danger)" }}>Danger Zone</h2>
          <p style={{ color: "var(--graphite)", fontSize: 14, marginBottom: 16 }}>
            Permanently delete your account, cloud diagrams, and all associated data. This action cannot be undone.
          </p>
          <DeleteAccountButton />
        </div>

      </main>
      <Footer />
    </>
  );
}
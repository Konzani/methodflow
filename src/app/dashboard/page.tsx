import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";

export const metadata = {
  title: "Dashboard | MethodFlow",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: diagrams } = await supabase
    .from("diagrams")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <>
      <Header />
      <main className="wrap page" style={{ minHeight: "60vh" }}>
        
        {/* Account Overview Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24, marginBottom: 48 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Your Workspace</h1>
            <p style={{ margin: 0, fontSize: 16 }}>
              Signed in as <strong>{user.email}</strong>
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--slate)" }}>
              Plan: <span style={{ background: "#E4F1E9", color: "#2E6B45", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Free Tier</span>
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 12 }}>
            <Link href="/pricing" className="btn ghost" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
              Upgrade to Pro
            </Link>
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
      </main>
      <Footer />
    </>
  );
}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ marginBottom: 8 }}>Your Diagrams</h1>
            <p style={{ margin: 0 }}>Signed in as {user.email}</p>
          </div>
          <Link href="/app" className="btn">+ New Flowchart</Link>
        </div>

        {(!diagrams || diagrams.length === 0) ? (
          <div className="plate" style={{ padding: "64px 24px", textAlign: "center" }}>
            <h2 style={{ fontSize: 24, marginBottom: 12 }}>No diagrams yet</h2>
            <p style={{ marginBottom: 24 }}>Create your first methodology flowchart to see it here.</p>
            <Link href="/app" className="btn">Open the Editor</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {diagrams.map((d) => (
              <div key={d.id} className="plate" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
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
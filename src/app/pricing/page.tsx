"use client";
import { useState } from "react";
import { Header, Footer } from "@/components/Chrome";

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleUpgrade = async (plan: string) => {
    setLoading(plan);
    setError("");
    try {
      const res = await fetch("/api/lemonsqueezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (!res.ok) throw new Error(data.message || "Checkout failed");
      
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 1000 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 42 }}>Simple, transparent pricing</h1>
          <p style={{ fontSize: 18, color: "var(--graphite)", marginTop: 12 }}>
            Start for free. Upgrade when you're ready to write your thesis.
          </p>
          {error && <p style={{ color: "var(--danger)", marginTop: 16, fontWeight: 600 }}>{error}</p>}
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, alignItems: "stretch" }}>
          
          {/* Free Plan */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Free</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$0</p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Perfect for testing the tool.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 12 }}>
              <li>✓ 3 AI generations / day</li>
              <li>✓ Basic styling & templates</li>
              <li>✓ PNG & SVG export (watermarked)</li>
              <li style={{ color: "#ccc" }}>✗ No PDF upload</li>
              <li style={{ color: "#ccc" }}>✗ No Word/LaTeX export</li>
            </ul>
            <button disabled className="wide" style={{ padding: 12, background: "var(--wash)", border: "1px solid var(--line)", color: "var(--slate)" }}>Current Plan</button>
          </div>

          {/* Pro Monthly */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", borderColor: "var(--accent)", borderWidth: 2 }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Pro Monthly</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$5 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ mo</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Cancel anytime.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 12 }}>
              <li>✓ Unlimited AI generations</li>
              <li>✓ Smart PDF & DOCX Upload</li>
              <li>✓ Word & LaTeX (TikZ) exports</li>
              <li>✓ Cloud save & dashboard</li>
              <li>✓ Zero watermarks</li>
            </ul>
            <button onClick={() => handleUpgrade("monthly")} disabled={loading !== null} className="pri wide" style={{ padding: 12 }}>
              {loading === "monthly" ? "Loading..." : "Upgrade to Pro"}
            </button>
          </div>

          {/* Pro Yearly (Highlighted) */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", borderColor: "var(--ink)", borderWidth: 2, position: "relative" }}>
            <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>BEST VALUE</div>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Pro Yearly</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$36 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ yr</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Save 40%. Perfect for a full thesis.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 12 }}>
              <li>✓ Everything in Monthly</li>
              <li>✓ Advanced Reasoning Engine</li>
              <li>✓ Priority support</li>
            </ul>
            <button onClick={() => handleUpgrade("yearly")} disabled={loading !== null} className="pri wide" style={{ padding: 12 }}>
              {loading === "yearly" ? "Loading..." : "Get Yearly Discount"}
            </button>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
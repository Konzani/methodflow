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
      
      if (!res.ok) throw new Error(data.message || "Failed to create checkout");
      
      // Redirect the user to the Lemon Squeezy secure checkout page
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(null);
    }
  };

  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 900 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 42 }}>Upgrade to MethodFlow Pro</h1>
          <p style={{ fontSize: 18, color: "var(--graphite)", marginTop: 12 }}>
            Unlock unlimited generations, PDF uploads, and thesis-ready Word/LaTeX exports.
          </p>
          {error && <p style={{ color: "var(--danger)", marginTop: 16 }}>{error}</p>}
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          
          {/* Monthly Plan */}
          <div className="plate" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Monthly</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$5 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ month</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Flexible billing. Cancel anytime.</p>
            <button 
              onClick={() => handleUpgrade("monthly")} 
              disabled={loading !== null}
              className="pri wide" 
              style={{ padding: 12 }}
            >
              {loading === "monthly" ? "Redirecting..." : "Select Monthly"}
            </button>
          </div>

          {/* Half-Yearly Plan */}
          <div className="plate" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column" }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Half-Yearly</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$24 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ 6 months</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Save 20%. Perfect for a semester.</p>
            <button 
              onClick={() => handleUpgrade("half-yearly")} 
              disabled={loading !== null}
              className="pri wide" 
              style={{ padding: 12 }}
            >
              {loading === "half-yearly" ? "Redirecting..." : "Select Half-Yearly"}
            </button>
          </div>

          {/* Yearly Plan (Highlighted) */}
          <div className="plate" style={{ padding: 32, textAlign: "center", borderColor: "var(--accent)", borderWidth: 2, position: "relative", display: "flex", flexDirection: "column" }}>
            <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>BEST VALUE</div>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Yearly</h2>
            <p style={{ fontSize: 36, fontWeight: "bold", margin: "16px 0" }}>$36 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ year</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 24 }}>Save 40%. Best for completing a full thesis.</p>
            <button 
              onClick={() => handleUpgrade("yearly")} 
              disabled={loading !== null}
              className="pri wide" 
              style={{ padding: 12 }}
            >
              {loading === "yearly" ? "Redirecting..." : "Select Yearly"}
            </button>
          </div>

        </div>

        <div style={{ marginTop: 64, textAlign: "center" }}>
          <h3 style={{ fontSize: 22, marginBottom: 16 }}>Everything included in Pro:</h3>
          <ul style={{ listStyle: "none", padding: 0, color: "var(--graphite)", lineHeight: 2 }}>
            <li>Unlimited AI Generations & Refinements</li>
            <li>Smart PDF & DOCX Upload</li>
            <li>Advanced Reasoning Engine for complex logic</li>
            <li>Word (.docx) and LaTeX (TikZ) Exports</li>
            <li>Cloud Save & Cross-Device Access</li>
            <li>Zero Watermarks on all exports</li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
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

  const Check = () => <span style={{ color: "var(--accent)", fontWeight: "bold", marginRight: 8 }}>✓</span>;
  const Cross = () => <span style={{ color: "#ccc", marginRight: 8 }}>✗</span>;

  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 1200, paddingTop: 64, paddingBottom: 96 }}>
        
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h1 style={{ fontSize: 48, letterSpacing: "-0.02em", marginBottom: 16 }}>Simple, transparent pricing.</h1>
          <p style={{ fontSize: 18, color: "var(--graphite)", maxWidth: 600, margin: "0 auto" }}>
            Start for free. Upgrade when you're ready to generate thesis-ready diagrams with our most advanced AI.
          </p>
          {error && <p style={{ color: "var(--danger)", marginTop: 24, fontWeight: 600, background: "#FBE6EC", padding: "12px 24px", borderRadius: 8, display: "inline-block" }}>{error}</p>}
        </div>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
          gap: 24, 
          alignItems: "stretch",
          marginTop: 32
        }}>
          
          {/* Free Plan */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", background: "var(--wash)", border: "1px solid var(--line)" }}>
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--sans)" }}>Free</h2>
            <p style={{ fontSize: 40, fontWeight: "bold", margin: "16px 0 24px" }}>$0</p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 32, fontSize: 15 }}>Perfect for exploring the tool and basic diagrams.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 16 }}>
              <li><Check /> 3 AI generations / day</li>
              <li><Check /> Standard AI model</li>
              <li><Check /> Basic styling & palettes</li>
              <li><Check /> PNG & SVG export</li>
              <li><Cross /> <span style={{ color: "#aaa" }}>No watermarks removed</span></li>
              <li><Cross /> <span style={{ color: "#aaa" }}>No PDF/DOCX upload</span></li>
              <li><Cross /> <span style={{ color: "#aaa" }}>No Word/LaTeX export</span></li>
            </ul>
            <button disabled className="wide" style={{ padding: 14, background: "transparent", border: "1px solid var(--line)", color: "var(--slate)", borderRadius: "var(--r)" }}>Current Plan</button>
          </div>

          {/* Pro Monthly */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", background: "#fff", border: "1px solid var(--line)" }}>
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--sans)" }}>Pro Monthly</h2>
            <p style={{ fontSize: 40, fontWeight: "bold", margin: "16px 0 24px" }}>$5 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ mo</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 32, fontSize: 15 }}>Flexible billing for short projects.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 16 }}>
              <li><Check /> Unlimited AI generations</li>
              <li><Check /> Advanced Reasoning Engine</li>
              <li><Check /> Smart PDF & DOCX Upload</li>
              <li><Check /> Cloud save & Dashboard</li>
              <li><Check /> Word & LaTeX (TikZ) export</li>
              <li><Check /> Zero watermarks</li>
            </ul>
            <button onClick={() => handleUpgrade("monthly")} disabled={loading !== null} className="wide" style={{ padding: 14, border: "1px solid var(--ink)", background: "#fff", color: "var(--ink)", borderRadius: "var(--r)", fontWeight: 600 }}>
              {loading === "monthly" ? "Loading..." : "Select Monthly"}
            </button>
          </div>

          {/* Pro Half-Yearly */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", background: "#fff", border: "1px solid var(--line)" }}>
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--sans)" }}>Pro Half-Yearly</h2>
            <p style={{ fontSize: 40, fontWeight: "bold", margin: "16px 0 24px" }}>$24 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ 6 mo</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 32, fontSize: 15 }}>Save 20%. Ideal for a single semester.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 16 }}>
              <li><Check /> Unlimited AI generations</li>
              <li><Check /> Advanced Reasoning Engine</li>
              <li><Check /> Smart PDF & DOCX Upload</li>
              <li><Check /> Cloud save & Dashboard</li>
              <li><Check /> Word & LaTeX (TikZ) export</li>
              <li><Check /> Zero watermarks</li>
            </ul>
            <button onClick={() => handleUpgrade("half-yearly")} disabled={loading !== null} className="wide" style={{ padding: 14, border: "1px solid var(--ink)", background: "#fff", color: "var(--ink)", borderRadius: "var(--r)", fontWeight: 600 }}>
              {loading === "half-yearly" ? "Loading..." : "Select Half-Yearly"}
            </button>
          </div>

          {/* Pro Yearly (Highlighted) */}
          <div className="plate" style={{ padding: 32, display: "flex", flexDirection: "column", background: "#fff", border: "2px solid var(--accent)", position: "relative", boxShadow: "0 12px 32px rgba(29,59,92,0.08)" }}>
            <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "var(--accent)", color: "#fff", padding: "6px 16px", borderRadius: 24, fontSize: 11, fontWeight: "bold", letterSpacing: 1, whiteSpace: "nowrap" }}>BEST VALUE</div>
            
            <h2 style={{ fontSize: 20, marginBottom: 8, fontFamily: "var(--sans)", color: "var(--accent)" }}>Pro Yearly</h2>
            <p style={{ fontSize: 40, fontWeight: "bold", margin: "16px 0 24px" }}>$36 <span style={{ fontSize: 16, fontWeight: "normal", color: "var(--slate)" }}>/ yr</span></p>
            <p style={{ color: "var(--graphite)", flex: 1, marginBottom: 32, fontSize: 15 }}>Save 40%. The best choice for your full thesis.</p>
            <ul style={{ listStyle: "none", padding: 0, marginBottom: 32, fontSize: 14, color: "var(--graphite)", display: "grid", gap: 16 }}>
              <li><Check /> Unlimited AI generations</li>
              <li><Check /> Advanced Reasoning Engine</li>
              <li><Check /> Smart PDF & DOCX Upload</li>
              <li><Check /> Cloud save & Dashboard</li>
              <li><Check /> Word & LaTeX (TikZ) export</li>
              <li><Check /> Zero watermarks</li>
            </ul>
            <button onClick={() => handleUpgrade("yearly")} disabled={loading !== null} className="pri wide" style={{ padding: 14, borderRadius: "var(--r)", fontWeight: 600 }}>
              {loading === "yearly" ? "Loading..." : "Select Yearly"}
            </button>
          </div>

        </div>

        {/* Feature Comparison Table (Optional but adds premium feel) */}
        <div style={{ marginTop: 96, maxWidth: 800, margin: "96px auto 0" }}>
          <h2 style={{ fontSize: 28, textAlign: "center", marginBottom: 40 }}>Everything you need to finish your thesis</h2>
          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ fontSize: 18, fontFamily: "var(--sans)" }}>Advanced Reasoning Engine</h3>
              <p style={{ color: "var(--graphite)" }}>Access our highest-tier AI model, specifically designed to untangle complex, multi-stage methodologies like PRISMA, Machine Learning, and Mixed Methods.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ fontSize: 18, fontFamily: "var(--sans)" }}>Smart PDF & DOCX Upload</h3>
              <p style={{ color: "var(--graphite)" }}>Drag and drop your research proposal. Our AI reads the document, extracts the methodology, and builds the flowchart instantly.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
              <h3 style={{ fontSize: 18, fontFamily: "var(--sans)" }}>Publication-Ready Exports</h3>
              <p style={{ color: "var(--graphite)" }}>Export directly to Word (.docx) with auto-numbered captions, or copy flawless LaTeX (TikZ) code for Overleaf. All exports are completely free of watermarks.</p>
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </>
  );
}
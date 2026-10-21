"use client";
import { useUpgradeStore } from "@/stores/upgrade";
import Link from "next/link";
import { useEffect } from "react";

export function UpgradeModal() {
  const { isOpen, reason, close } = useUpgradeStore();

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = {
    limit: {
      title: "You've reached your daily limit.",
      desc: "Don't lose your momentum. Upgrade to Pro for unlimited AI generations and finish your methodology without interruptions.",
      cta: "Unlock Unlimited Generations"
    },
    watermark: {
      title: "Your draft has downloaded.",
      desc: "Upgrade to Pro to export clean, watermark-free figures ready for your thesis, supervisor review, and publication.",
      cta: "Remove Watermarks"
    },
    feature: {
      title: "Save hours of manual formatting.",
      desc: "Word, LaTeX, PDF Uploads, and Advanced AI models are available on MethodFlow Pro. Upgrade to automate your thesis formatting.",
      cta: "View Pro Features"
    }
  };

  const activeContent = content[reason || "feature"];

  return (
    <div className="scrim" onClick={close} style={{ zIndex: 100, backdropFilter: "blur(4px)" }}>
      <div 
        className="modal" 
        role="dialog" 
        aria-modal="true" 
        aria-label="Upgrade to Pro" 
        onClick={e => e.stopPropagation()}
        style={{ padding: 40, maxWidth: 500, textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.15)" }}
      >
        <div style={{ display: "inline-block", padding: "6px 12px", background: "var(--wash)", color: "var(--accent)", borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", marginBottom: 24 }}>
          METHODFLOW PRO
        </div>
        
        <h2 style={{ fontSize: 28, marginBottom: 16 }}>{activeContent.title}</h2>
        <p style={{ color: "var(--graphite)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
          {activeContent.desc}
        </p>

        <div style={{ background: "var(--wash)", padding: 24, borderRadius: "var(--r)", marginBottom: 32, textAlign: "left", fontSize: 14, color: "var(--graphite)", display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)", fontWeight: "bold" }}>✓</span> Unlimited AI generations</div>
          <div style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)", fontWeight: "bold" }}>✓</span> Advanced Reasoning Engine</div>
          <div style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)", fontWeight: "bold" }}>✓</span> Smart PDF & DOCX Upload</div>
          <div style={{ display: "flex", gap: 8 }}><span style={{ color: "var(--accent)", fontWeight: "bold" }}>✓</span> Word & LaTeX (TikZ) exports</div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <Link href="/pricing" className="pri wide" style={{ padding: 14, textDecoration: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 16 }}>
            {activeContent.cta}
          </Link>
          <button className="wide" onClick={close} style={{ padding: 14, background: "transparent", border: "none", color: "var(--slate)", fontSize: 14 }}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
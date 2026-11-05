"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setLoading(true);
    
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      
      if (res.ok) {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      } else {
        alert("Failed to delete account. Please try again or contact support.");
        setLoading(false);
      }
    } catch (err) {
      alert("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{ padding: "8px 16px", border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", borderRadius: "var(--r)", cursor: "pointer", fontWeight: 600 }}
      >
        Delete Account
      </button>
    );
  }

  return (
    <div style={{ background: "#FBE6EC", border: "1px solid #9C3D5A", padding: 24, borderRadius: 8, maxWidth: 500 }}>
      <h3 style={{ fontSize: 18, color: "#9C3D5A", marginBottom: 8 }}>Are you absolutely sure?</h3>
      <p style={{ fontSize: 14, color: "#9C3D5A", marginBottom: 16, lineHeight: 1.5 }}>
        This will permanently delete your account and all your cloud diagrams. 
        If you have an active Pro subscription, please cancel it in your billing portal first to avoid future charges.
      </p>
      <p style={{ fontSize: 14, color: "#9C3D5A", marginBottom: 8, fontWeight: 600 }}>
        Type DELETE to confirm.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input 
          type="text" 
          value={confirmText} 
          onChange={(e) => setConfirmText(e.target.value)} 
          placeholder="DELETE"
          style={{ flex: 1, padding: "8px 12px", border: "1px solid #9C3D5A", borderRadius: 4, outline: "none" }}
        />
        <button 
          onClick={handleDelete}
          disabled={confirmText !== "DELETE" || loading}
          style={{ 
            background: confirmText === "DELETE" ? "#9C3D5A" : "#E3C9C9", 
            color: "#fff", 
            border: "none", 
            padding: "8px 16px", 
            borderRadius: 4, 
            cursor: confirmText === "DELETE" ? "pointer" : "not-allowed", 
            fontWeight: 600 
          }}
        >
          {loading ? "Deleting..." : "Confirm"}
        </button>
        <button 
          onClick={() => { setIsOpen(false); setConfirmText(""); }}
          disabled={loading}
          style={{ background: "transparent", color: "#9C3D5A", border: "1px solid #9C3D5A", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
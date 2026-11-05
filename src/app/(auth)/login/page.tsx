"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "token">("email");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg("");
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) setMsg(error.message);
    else { setStep("token"); setMsg("Check your email for the 6-digit code."); }
    setLoading(false);
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg("");
    
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <main className="wrap page" style={{ maxWidth: 400, marginTop: 100 }}>
      <h1>Sign in to MethodFlow</h1>
      
      {step === "email" ? (
        <>
          <p>Enter your email to receive a secure 6-digit login code.</p>
          
          <form onSubmit={handleSendEmail} style={{ display: "grid", gap: 12, marginTop: 24 }}>
            <label className="f">
              Email
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="you@gmail.com" 
                required 
              />
            </label>
            <button className="pri" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Login Code"}
            </button>
            <p className="note" style={{ fontSize: 11, textAlign: 'center' }}>
              Any email works: Gmail, Yahoo, university, etc.
            </p>
          </form>
        </>
      ) : (
        <>
          <p>We sent a 6-digit code to <strong>{email}</strong>.</p>
          <form onSubmit={handleVerifyToken} style={{ display: "grid", gap: 12, marginTop: 24 }}>
            <label className="f">
              6-Digit Code
              <input 
                type="text" 
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="123456" 
                required 
                maxLength={6} 
              />
            </label>
            <button className="pri" type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify & Log In"}
            </button>
          </form>
        </>
      )}

      {msg && <p className="note" style={{ marginTop: 16, color: "var(--accent)" }}>{msg}</p>}
      
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <Link href="/app">Continue as Guest instead</Link>
      </p>
    </main>
  );
}
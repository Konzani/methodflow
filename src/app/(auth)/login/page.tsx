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

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });
    if (error) setMsg(error.message);
  };

  return (
    <main className="wrap page" style={{ maxWidth: 400, marginTop: 100 }}>
      <h1>Sign in to MethodFlow</h1>
      
      {step === "email" ? (
        <>
          <p>Enter your email to receive a secure login code.</p>
          
          {/* Google Login Button */}
          <button 
            onClick={handleGoogleLogin} 
            type="button"
            className="wide" 
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              padding: '10px', marginTop: 24, marginBottom: 16, 
              background: '#fff', border: '1px solid var(--line)', cursor: 'pointer' 
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }}></div>
            <span style={{ padding: '0 10px', fontSize: 13, color: 'var(--slate)' }}>or use email</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--line)' }}></div>
          </div>

          <form onSubmit={handleSendEmail} style={{ display: "grid", gap: 12 }}>
            <label className="f">
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" required />
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
              <input type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="123456" required maxLength={6} />
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
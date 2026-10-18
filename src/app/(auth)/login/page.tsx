"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Check your email for the login link!");
    }
    setLoading(false);
  };

  return (
    <main className="wrap page" style={{ maxWidth: 400, marginTop: 100 }}>
      <h1>Sign in to MethodFlow</h1>
      <p>Enter your email to receive a magic login link. No password required.</p>
      
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label className="f">
          Email
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="you@university.edu" 
            required 
          />
        </label>
        <button className="pri" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
      </form>

      {msg && <p className="note" style={{ marginTop: 16, color: "var(--accent)" }}>{msg}</p>}
      
      <p style={{ marginTop: 24, fontSize: 14 }}>
        <a href="/app">Continue as Guest instead</a>
      </p>
    </main>
  );
}
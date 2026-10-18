"use client";
import { useState } from "react";
import { Header, Footer } from "@/components/Chrome";
import Link from "next/link";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, honeypot }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send message.");
      }

      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 600 }}>
        <h1>Contact MethodFlow</h1>
        <p>Have a question, found a bug, or want to request a feature? Send us a message and we'll get back to you.</p>

        {status === "success" ? (
          <div className="plate" style={{ padding: 32, textAlign: "center", marginTop: 32 }}>
            <h2 style={{ color: "var(--accent)", marginBottom: 12 }}>Message sent!</h2>
            <p>Thank you for reaching out. We'll get back to you as soon as possible.</p>
            <button className="btn" onClick={() => setStatus("idle")} style={{ marginTop: 16 }}>Send another</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, marginTop: 32 }}>
            {/* Honeypot field - hidden from humans, filled by bots */}
            <input
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: "none" }}
              tabIndex={-1}
              autoComplete="off"
            />

            <label className="f">
              Your Name
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Doe"
              />
            </label>

            <label className="f">
              Your Email
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@university.edu"
              />
            </label>

            <label className="f">
              Message
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="How can we help?"
              />
            </label>

            <button className="pri" type="submit" disabled={status === "sending"} style={{ padding: 12 }}>
              {status === "sending" ? "Sending..." : "Send Message"}
            </button>

            {status === "error" && <p className="note" style={{ color: "var(--danger)" }}>{errorMsg}</p>}
          </form>
        )}

        <p style={{ marginTop: 32, fontSize: 14 }}>
          Alternatively, you can email us directly at <a href="mailto:methodflow@geodesia.online">methodflow@geodesia.online</a>.
        </p>
      </main>
      <Footer />
    </>
  );
}
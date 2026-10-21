"use client";
import { useState, useEffect } from "react";
import { Header, Footer } from "@/components/Chrome";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Plan = "free" | "pro";
type Status = "loading" | "guest" | Plan;
type Billing = "monthly" | "half-yearly" | "yearly";

const MONTHLY_PRICE = 5;

const BILLING: Record<
  Billing,
  { label: string; price: number; months: number; cadence: string; blurb: string }
> = {
  monthly: { label: "Monthly", price: 5, months: 1, cadence: "month", blurb: "Flexible billing for short projects." },
  "half-yearly": { label: "6 months", price: 24, months: 6, cadence: "6 months", blurb: "Covers a full semester." },
  yearly: { label: "Yearly", price: 36, months: 12, cadence: "year", blurb: "Covers your whole thesis, start to submission." },
};

const BILLING_ORDER: Billing[] = ["monthly", "half-yearly", "yearly"];

const savings = (b: Billing) =>
  Math.round((1 - BILLING[b].price / BILLING[b].months / MONTHLY_PRICE) * 100);

const perMonth = (b: Billing) => {
  const v = BILLING[b].price / BILLING[b].months;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

const FREE_FEATURES = [
  "3 AI generations per day",
  "Standard AI model",
  "Basic styling and palettes",
  "PNG and SVG export",
];

const PRO_FEATURES = [
  "Unlimited AI generations",
  "Advanced reasoning engine",
  "PDF and DOCX upload",
  "Cloud save and dashboard",
  "Word and LaTeX (TikZ) export",
  "No watermarks",
];

// true = included, false = not included, string = shown as text
const COMPARE: { feature: string; free: boolean | string; pro: boolean | string }[] = [
  { feature: "AI generations", free: "3 per day", pro: "Unlimited" },
  { feature: "AI model", free: "Standard", pro: "Advanced reasoning" },
  { feature: "PNG and SVG export", free: true, pro: true },
  { feature: "Watermark on exports", free: "Yes", pro: "None" },
  { feature: "PDF and DOCX upload", free: false, pro: true },
  { feature: "Cloud save and dashboard", free: false, pro: true },
  { feature: "Word (.docx) export", free: false, pro: true },
  { feature: "LaTeX (TikZ) export", free: false, pro: true },
];

// TODO: confirm every answer below matches your real policy before shipping.
const FAQ = [
  {
    q: "What counts as an AI generation?",
    a: "Each time you ask the AI to build or rebuild a diagram from your text or an uploaded document. Editing styles, colours and layout by hand doesn't use one.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You keep Pro until the end of the period you've paid for. After that your account returns to Free.",
  },
  {
    q: "Do you offer refunds?",
    a: "Email us within 7 days of your first payment and we'll sort it out.",
  },
  {
    q: "How do I pay?",
    a: "Checkout is handled by Lemon Squeezy, which shows the payment methods available in your country.",
  },
];

const css = `
.pf-wrap { max-width: 1040px; padding-top: 64px; padding-bottom: 96px; }
.pf-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 24px; align-items: stretch; }
.pf-card { background: #fff; border: 1px solid var(--line); border-radius: var(--r); padding: 32px; display: flex; flex-direction: column; }
.pf-card.pro { border: 2px solid var(--accent); box-shadow: 0 12px 32px rgba(29,59,92,0.08); }
.pf-seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: var(--wash); border: 1px solid var(--line); border-radius: var(--r); margin: 20px 0 8px; }
.pf-seg button { border: 0; background: transparent; padding: 10px 6px; border-radius: calc(var(--r) - 2px); cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: var(--graphite); display: grid; gap: 2px; justify-items: center; line-height: 1.2; }
.pf-seg button small { font-size: 12px; font-weight: 500; color: var(--slate); }
.pf-seg button[aria-checked="true"] { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.pf-seg button[aria-checked="true"] small { color: var(--accent); }
.pf-seg button:hover:not([aria-checked="true"]) { color: var(--ink); }
.pf-list { list-style: none; padding: 0; margin: 0 0 32px; display: grid; gap: 12px; font-size: 15px; color: var(--graphite); }
.pf-list li { display: flex; gap: 10px; align-items: baseline; }
.pf-tick { color: var(--accent); font-weight: 700; flex: none; }
.pf-cta { width: 100%; padding: 14px; border-radius: var(--r); font-weight: 600; font-size: 16px; cursor: pointer; text-align: center; text-decoration: none; display: block; box-sizing: border-box; }
.pf-cta[disabled] { opacity: 0.55; cursor: not-allowed; }
.pf-cta.ghost { background: transparent; border: 1px solid var(--line); color: var(--ink); }
.pf-cta.ghost:hover { border-color: var(--slate); }
.pf-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.pf-table th, .pf-table td { padding: 16px 12px; border-bottom: 1px solid var(--line); text-align: left; }
.pf-table thead th { font-size: 14px; color: var(--graphite); border-bottom: 2px solid var(--line); }
.pf-table th[scope="row"] { font-weight: 500; }
.pf-table td { width: 22%; color: var(--graphite); }
.pf-table td.pro, .pf-table thead th.pro { color: var(--ink); font-weight: 600; }
.pf-no { color: #b5b5b5; }
.pf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.pf-faq details { border-bottom: 1px solid var(--line); padding: 20px 0; }
.pf-faq summary { cursor: pointer; font-weight: 600; font-size: 17px; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
.pf-faq summary::-webkit-details-marker { display: none; }
.pf-faq summary::after { content: "+"; color: var(--slate); font-weight: 400; font-size: 22px; line-height: 1; }
.pf-faq details[open] summary::after { content: "\\2212"; }
.pf-faq p { margin: 12px 0 0; color: var(--graphite); max-width: 640px; }
.pf-wrap :is(button, a, summary):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 820px) {
  .pf-grid { grid-template-columns: minmax(0, 1fr); }
  .pf-card { padding: 24px; }
  .pf-table th, .pf-table td { padding: 14px 6px; font-size: 14px; }
}
@media (prefers-reduced-motion: no-preference) {
  .pf-seg button, .pf-cta { transition: background 0.15s, border-color 0.15s, color 0.15s; }
}
`;

export default function PricingPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [billing, setBilling] = useState<Billing>("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        setUser(user);
        if (!user) {
          setStatus("guest");
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .single();
        if (!cancelled) setStatus(profile?.plan === "pro" ? "pro" : "free");
      } catch {
        if (!cancelled) setStatus("guest");
      }
    })();

    // Returning from checkout via the back button restores the page with the
    // button still stuck on "Redirecting...", so reset it.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false);
    };
    window.addEventListener("pageshow", onShow);

    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  const handleUpgrade = async () => {
    if (!user) {
      window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lemonsqueezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: billing }),
      });
      let data: { redirect?: string; url?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON response, handled below */
      }
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.message || "We couldn't start checkout. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const isPro = status === "pro";
  const b = BILLING[billing];
  const save = savings(billing);

  const proLabel = loading
    ? "Opening checkout..."
    : isPro
    ? "You're on Pro"
    : `Upgrade to Pro for $${b.price} per ${b.cadence}`;

  return (
    <>
      <Header />
      <style>{css}</style>
      <main className="wrap page pf-wrap">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 48, letterSpacing: "-0.02em", marginBottom: 16 }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: 18, color: "var(--graphite)", maxWidth: 560, margin: "0 auto" }}>
            Start free. Upgrade when you need unlimited generations, document upload and watermark-free exports for your thesis.
          </p>
        </div>

        <div aria-live="polite">
          {error && (
            <p
              role="alert"
              style={{
                color: "var(--danger)",
                fontWeight: 600,
                background: "#FBE6EC",
                padding: "12px 20px",
                borderRadius: 8,
                margin: "0 auto 32px",
                maxWidth: 560,
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
        </div>

        {isPro && (
          <div
            style={{
              background: "#E4F1E9",
              border: "1px solid #2E6B45",
              color: "#2E6B45",
              padding: 16,
              borderRadius: 8,
              marginBottom: 32,
              fontWeight: 600,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span>You're subscribed to MethodFlow Pro.</span>
            <a
              href="/dashboard"
              className="btn"
              style={{ background: "#2E6B45", color: "#fff", padding: "8px 16px", textDecoration: "none" }}
            >
              Go to dashboard
            </a>
          </div>
        )}

        {status === "guest" && (
          <p
            style={{
              background: "var(--wash)",
              border: "1px solid var(--line)",
              padding: 16,
              borderRadius: 8,
              marginBottom: 32,
              textAlign: "center",
              color: "var(--graphite)",
            }}
          >
            You're browsing as a guest.{" "}
            <a href="/login?next=/pricing" style={{ fontWeight: 600, color: "var(--accent)" }}>
              Sign in
            </a>{" "}
            to upgrade or manage your plan.
          </p>
        )}

        <div className="pf-grid">
          {/* Free */}
          <section className="pf-card" aria-labelledby="plan-free">
            <h2 id="plan-free" style={{ fontSize: 20, fontFamily: "var(--sans)", marginBottom: 8 }}>
              Free
            </h2>
            <p style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, margin: "16px 0 8px" }}>$0</p>
            <p style={{ color: "var(--graphite)", marginBottom: 32, fontSize: 15 }}>
              Try the tool and make basic diagrams. Exports carry a watermark.
            </p>
            <ul className="pf-list" style={{ flex: 1 }}>
              {FREE_FEATURES.map((f) => (
                <li key={f}>
                  <span className="pf-tick" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            {status === "guest" || status === "loading" ? (
              <a href="/login?next=/dashboard" className="pf-cta ghost">
                Start free
              </a>
            ) : (
              <button className="pf-cta ghost" disabled>
                {isPro ? "Included in Pro" : "Your current plan"}
              </button>
            )}
          </section>

          {/* Pro */}
          <section className="pf-card pro" aria-labelledby="plan-pro">
            <h2 id="plan-pro" style={{ fontSize: 20, fontFamily: "var(--sans)", marginBottom: 0, color: "var(--accent)" }}>
              Pro
            </h2>

            <div className="pf-seg" role="radiogroup" aria-label="Billing period">
              {BILLING_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={billing === key}
                  onClick={() => setBilling(key)}
                  disabled={loading}
                >
                  {BILLING[key].label}
                  <small>{key === "monthly" ? "No commitment" : `Save ${savings(key)}%`}</small>
                </button>
              ))}
            </div>

            <p style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, margin: "20px 0 8px" }}>
              ${perMonth(billing)}
              <span style={{ fontSize: 16, fontWeight: 400, color: "var(--slate)" }}> / month</span>
            </p>
            <p style={{ fontSize: 14, color: "var(--slate)", margin: "0 0 8px" }}>
              Billed ${b.price} every {b.months === 1 ? "month" : b.cadence}.
              {save > 0 && ` You save ${save}% compared with monthly.`}
            </p>
            <p style={{ color: "var(--graphite)", marginBottom: 28, fontSize: 15 }}>{b.blurb}</p>

            <ul className="pf-list" style={{ flex: 1 }}>
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <span className="pf-tick" aria-hidden="true">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="pri pf-cta"
              onClick={handleUpgrade}
              disabled={loading || isPro || status === "loading"}
            >
              {proLabel}
            </button>
            <p style={{ fontSize: 13, color: "var(--slate)", textAlign: "center", margin: "12px 0 0" }}>
              Secure checkout by Lemon Squeezy.
            </p>
          </section>
        </div>

        {/* Comparison */}
        <section style={{ marginTop: 96, maxWidth: 800, marginLeft: "auto", marginRight: "auto" }}>
          <h2 style={{ fontSize: 28, textAlign: "center", marginBottom: 32 }}>
            Everything you need to finish your thesis
          </h2>

          <table className="pf-table">
            <caption className="pf-sr">Free and Pro compared</caption>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Free</th>
                <th scope="col" className="pro">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  {(["free", "pro"] as const).map((col) => {
                    const v = row[col];
                    return (
                      <td key={col} className={col === "pro" ? "pro" : undefined}>
                        {typeof v === "string" ? (
                          v
                        ) : v ? (
                          <>
                            <span className="pf-tick" aria-hidden="true">✓</span>
                            <span className="pf-sr">Included</span>
                          </>
                        ) : (
                          <>
                            <span className="pf-no" aria-hidden="true">–</span>
                            <span className="pf-sr">Not included</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "grid", gap: 24, marginTop: 56 }}>
            {[
              {
                t: "Advanced reasoning engine",
                d: "Our most capable model, built for multi-stage methodologies such as PRISMA, machine learning pipelines and mixed methods.",
              },
              {
                t: "PDF and DOCX upload",
                d: "Drop in your research proposal. The AI reads it, pulls out the methodology and builds the flowchart for you.",
              },
              {
                t: "Publication-ready export",
                d: "Export to Word with auto-numbered captions, or copy LaTeX (TikZ) code straight into Overleaf. Pro exports have no watermark.",
              },
            ].map((x) => (
              <div
                key={x.t}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 16,
                  paddingBottom: 24,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <h3 style={{ fontSize: 18, fontFamily: "var(--sans)" }}>{x.t}</h3>
                <p style={{ color: "var(--graphite)", gridColumn: "span 2", maxWidth: 520 }}>{x.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="pf-faq" style={{ marginTop: 96, maxWidth: 800, marginLeft: "auto", marginRight: "auto" }}>
          <h2 style={{ fontSize: 28, textAlign: "center", marginBottom: 24 }}>Questions</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
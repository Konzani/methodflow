import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { 
  title: "Refund Policy", 
  alternates: { canonical: "/refund" } 
};

export default function Refund() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Refund Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7-Day Money-Back Guarantee</h2>
        <p>We want you to be completely satisfied with {SITE.name}. If the tool doesn't save you time on your thesis or research project, we offer a full refund within <strong>7 days</strong> of your first payment.</p>
        
        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>How to Request a Refund</h2>
        <p>To request a refund, email us at <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with the subject line "Refund Request" and the email address associated with your account. We will process the refund through Lemon Squeezy (our payment provider).</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Subscription Cancellations</h2>
        <p>You can cancel your Pro subscription at any time from your billing dashboard. If you cancel, you will not be charged for the next billing cycle, but you will retain Pro access until the end of your current paid period. We do not offer partial refunds for mid-cycle cancellations.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Abuse</h2>
        <p>We reserve the right to refuse refunds if we detect abuse of the free tier or the refund policy (e.g., repeatedly subscribing, generating hundreds of diagrams, and requesting refunds).</p>
      </main>
      <Footer />
    </>
  );
}
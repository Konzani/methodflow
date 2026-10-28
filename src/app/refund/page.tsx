import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Refund Policy", alternates: { canonical: "/refund" } };

export default function Refund() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Refund Policy</h1>
        <p>Last updated: October 2026</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7-Day Guarantee</h2>
        <p>If {SITE.name} does not meet your expectations, you may request a full refund within 7 days of your first subscription payment. We offer this guarantee to ensure you can evaluate the tool risk-free.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Requesting a Refund</h2>
        <p>To request a refund, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> from the email address associated with your account. Refunds will be processed to the original payment method within 5 to 10 business days.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Cancellations</h2>
        <p>You may cancel your subscription at any time. Upon cancellation, you will retain access to premium features until the end of your current billing cycle. Partial refunds for unused time are not provided.</p>
      </main>
      <Footer />
    </>
  );
}
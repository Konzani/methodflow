import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of Service", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Terms of Service</h1>
        <p>Last updated: October 2026</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>1. Agreement to Terms</h2>
        <p>By accessing {SITE.name}, you agree to be bound by these Terms of Service.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>2. Description of Service</h2>
        <p>{SITE.name} is an AI-assisted tool designed to help researchers generate methodology flowcharts.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>3. Acceptable Use</h2>
        <p>You agree not to use the Service for fraudulent research, plagiarism, or academic misconduct. The AI generates drafts; you must verify all steps. We reserve the right to suspend accounts that abuse the free tier, attempt to bypass rate limits, or exploit the refund policy.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>4. Intellectual Property</h2>
        <p><strong>Your Content:</strong> You retain all rights to the text you submit and the final diagrams you export. <br/><strong>Our Software:</strong> We retain all rights to the {SITE.name} platform and its underlying code.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>5. Disclaimer of Warranties</h2>
        <p>The Service is provided "as is". We are not liable for any academic penalties, rejection of papers, or grading disputes resulting from the use of this tool.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>6. Governing Law</h2>
        <p>These Terms are governed by the laws of Kenya.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7. Contact</h2>
        <p>For questions regarding these Terms, contact: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </main>
      <Footer />
    </>
  );
}
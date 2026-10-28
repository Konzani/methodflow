import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { 
  title: "Terms of Service", 
  alternates: { canonical: "/terms" } 
};

export default function Terms() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>1. Agreement to Terms</h2>
        <p>By accessing {SITE.name} ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, you may not use the Service.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>2. Description of Service</h2>
        <p>{SITE.name} is an AI-assisted tool designed to help researchers generate methodology flowcharts. The Service uses third-party AI providers to process text and generate diagrams.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>3. User Responsibilities & Academic Integrity</h2>
        <p>You are solely responsible for the content you submit. You agree not to use the Service to generate diagrams for fraudulent research, plagiarism, or academic misconduct. The AI generates drafts; you must verify all steps, decisions, and technical details against your actual research methodology.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>4. Intellectual Property</h2>
        <p><strong>Your Content:</strong> You retain all rights to the text you submit and the final diagrams you export. <br/>
        <strong>Our Software:</strong> We retain all rights to the {SITE.name} platform, including the layout engine, UI, and code.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>5. Disclaimer of Warranties</h2>
        <p>The Service is provided "as is" and "as available." We make no warranties that the AI-generated diagrams will be error-free, academically accurate, or fit for a specific purpose (such as journal publication). We are not liable for any academic penalties, rejection of papers, or grading disputes resulting from the use of this tool.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>6. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, {SITE.name} shall not be liable for any indirect, incidental, or consequential damages resulting from your use of the Service.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7. Payments & Subscriptions</h2>
        <p>Payments are processed securely by Lemon Squeezy. By subscribing to the Pro tier, you agree to their respective terms of service. Subscriptions renew automatically until cancelled.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>8. Governing Law</h2>
        <p>These Terms are governed by the laws of Kenya. Any disputes shall be subject to the exclusive jurisdiction of the courts of Kenya.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>9. Contact</h2>
        <p>For questions regarding these Terms, contact: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </main>
      <Footer />
    </>
  );
}
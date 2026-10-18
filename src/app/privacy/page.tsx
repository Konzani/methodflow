import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>1. Overview</h2>
        <p>{SITE.name} is designed to be privacy-friendly. You can use the flowchart editor without creating an account. If you choose to create an account, we store the diagrams you explicitly save to the cloud.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>2. Accounts & Cloud Storage</h2>
        <p>If you sign up, we store your email address (via Supabase) to manage your login. When you click "Save to Cloud", the flowchart data (JSON) is securely stored in our database and linked to your user ID. We do not sell this data.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>3. AI Generation</h2>
        <p>The text and details you submit for generation or refinement are sent to a third-party AI provider (DeepSeek) to produce the diagram. We do not permanently store the raw text you paste into the generator.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>4. Sharing</h2>
        <p>If you create a read-only share link, the diagram is stored on our server for 90 days so anyone with the link can view it. After 90 days, it is automatically deleted.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>5. Cookies</h2>
        <p>We use essential cookies for authentication (Supabase) and anonymous, aggregate analytics (Vercel) to understand site traffic. We do not use third-party advertising cookies.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>6. Data Deletion</h2>
        <p>You can delete your cloud diagrams at any time from your dashboard. To delete your account entirely and all associated data, please contact us.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7. Contact</h2>
        <p>Questions or deletion requests: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </main>
      <Footer />
    </>
  );
}
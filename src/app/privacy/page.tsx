import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import Link from "next/link";

export const metadata: Metadata = { 
  title: "Privacy Policy", 
  alternates: { canonical: "/privacy" } 
};

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 800 }}>
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>1. Overview</h2>
        <p>MethodFlow ("we", "us", or "our") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our website and services.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>2. Information We Collect</h2>
        <ul style={{ color: "var(--graphite)", lineHeight: 1.6, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}><strong>Account Information:</strong> If you create an account, we collect your email address to manage your login and account security.</li>
          <li style={{ marginBottom: 8 }}><strong>User Content:</strong> We store the flowchart diagrams you explicitly save to your cloud dashboard.</li>
          <li style={{ marginBottom: 8 }}><strong>Automated Data:</strong> We collect anonymized, aggregate usage data to understand how our service is used and to improve performance.</li>
        </ul>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>3. How We Use Your Information</h2>
        <ul style={{ color: "var(--graphite)", lineHeight: 1.6, paddingLeft: 20 }}>
          <li style={{ marginBottom: 8 }}>To provide, maintain, and secure our services.</li>
          <li style={{ marginBottom: 8 }}>To process your prompts and generate flowchart diagrams. Your prompts are processed securely by our AI partners and are <strong>not</strong> used to train public models.</li>
          <li style={{ marginBottom: 8 }}>To communicate with you regarding support or account updates.</li>
        </ul>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>4. Third-Party Service Providers</h2>
        <p>We do not sell your personal data. We use trusted third-party service providers to host our infrastructure, manage authentication, process AI requests, and handle payment processing. These providers are bound by strict data processing agreements and only access the data necessary to perform their specific functions.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>5. Data Retention & Deletion</h2>
        <p>You have full control over your data. You can delete individual cloud diagrams at any time from your dashboard. Additionally, you can permanently delete your account and all associated data directly from the <strong>Danger Zone</strong> in your dashboard settings. Once deleted, this data cannot be recovered. Shared links are stored temporarily and are subject to automatic expiration.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>6. Cookies</h2>
        <p>We use strictly necessary cookies to keep you logged in and secure your session. We may also use privacy-friendly analytics cookies to measure site traffic. We do not use third-party advertising or tracking cookies.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>7. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or your data, please contact us at <a href="mailto:methodflow@geodesia.online">methodflow@geodesia.online</a>.</p>
      </main>
      <Footer />
    </>
  );
}
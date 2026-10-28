import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";

export const metadata: Metadata = { title: "Cookie Policy", alternates: { canonical: "/cookies" } };

export default function Cookies() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Cookie Policy</h1>
        <p>Last updated: October 2026</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>1. Essential Cookies</h2>
        <p>We use strictly necessary cookies to authenticate your session and secure your account. These cookies are required for the platform to function and cannot be disabled if you wish to use the Service.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>2. Analytics</h2>
        <p>We collect anonymized, aggregate usage data to monitor the performance of our systems. We do not use third-party advertising cookies or track your activity across external websites.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>3. Your Choices</h2>
        <p>You can manage cookie preferences through your browser settings. Blocking essential cookies will prevent you from logging in.</p>
      </main>
      <Footer />
    </>
  );
}
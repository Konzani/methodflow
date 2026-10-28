import type { Metadata } from "next";
import { Header, Footer } from "@/components/Chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { 
  title: "Cookie Policy", 
  alternates: { canonical: "/cookies" } 
};

export default function Cookies() {
  return (
    <>
      <Header />
      <main className="wrap page">
        <h1>Cookie Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>What are cookies?</h2>
        <p>Cookies are small text files stored on your device that help websites function. {SITE.name} uses very few cookies, all designed to protect your security and improve your experience.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Strictly Necessary Cookies</h2>
        <p>We use Supabase for authentication. When you log in, Supabase stores a secure session cookie on your browser. This is strictly necessary to keep you logged in and to ensure your diagrams remain private to your account. We cannot turn this off.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Analytics</h2>
        <p>We use privacy-friendly analytics to understand how many people visit the site. We do not use tracking cookies that follow you across the internet, nor do we sell your data to advertisers.</p>

        <h2 style={{ fontSize: 22, margin: "28px 0 8px" }}>Managing Cookies</h2>
        <p>You can block or delete cookies through your browser settings. However, if you block essential cookies, you will not be able to log in to your {SITE.name} account.</p>
      </main>
      <Footer />
    </>
  );
}
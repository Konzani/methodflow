import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — MethodFlow AI for theses",
  description:
    "Start free, upgrade to MethodFlow AI Pro for the deeper reasoning engine, PDF/DOCX upload, watermark-free Word, PDF, SVG and LaTeX exports, 200 generations/day and cloud save. Student-friendly pricing.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { Header, Footer } from "@/components/Chrome";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guide: How to generate methodology flowcharts",
  description: "Learn how to write the perfect prompt to generate thesis-ready methodology flowcharts. Tips for PDF upload, AI refinement, and LaTeX exports.",
  alternates: { canonical: "/guide" },
};

export default function GuidePage() {
  return (
    <>
      <Header />
      <main className="wrap page" style={{ maxWidth: 800 }}>
        
        <h1 style={{ fontSize: 44, marginBottom: 16 }}>The MethodFlow Guide</h1>
        <p style={{ fontSize: 18, color: "var(--graphite)", marginBottom: 48 }}>
          Master the tool in 5 minutes. Learn how to prompt the AI, use PDF extraction, and export flawless diagrams for your thesis.
        </p>

        {/* Section 1 */}
        <section style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>1. The 60-Second Quickstart</h2>
          <ol style={{ display: "grid", gap: 16, fontSize: 16, color: "var(--graphite)", paddingLeft: 20 }}>
            <li><strong>Paste your text:</strong> Paste a paragraph describing your research methodology into the left panel.</li>
            <li><strong>Click Generate:</strong> The AI will analyze your text and draw a flowchart in seconds.</li>
            <li><strong>Edit & Export:</strong> Rename nodes, change colors, and export to PDF, Word, or LaTeX.</li>
          </ol>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>2. The Anatomy of a Perfect Prompt</h2>
          <p style={{ fontSize: 16, color: "var(--graphite)", marginBottom: 24 }}>
            The AI is only as good as the information you give it. If you type "Make a flowchart", you will get a generic result. You must include the <strong>technical details</strong> of your study.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div className="plate" style={{ padding: 24, background: "#FBE6EC", borderColor: "#9C3D5A" }}>
              <h3 style={{ color: "#9C3D5A", fontSize: 18, marginBottom: 12 }}>❌ The Bad Prompt</h3>
              <p style={{ fontSize: 14, color: "#9C3D5A", fontStyle: "italic" }}>
                "I am doing a survey on mobile banking in Kenya. Make me a flowchart."
              </p>
            </div>
            <div className="plate" style={{ padding: 24, background: "#E4F1E9", borderColor: "#2E6B45" }}>
              <h3 style={{ color: "#2E6B45", fontSize: 18, marginBottom: 12 }}>✅ The Perfect Prompt</h3>
              <p style={{ fontSize: 14, color: "#2E6B45", fontStyle: "italic" }}>
                "A cross-sectional survey was conducted with 250 postgraduate students recruited through stratified random sampling. Data were collected using a validated 40-item questionnaire. Ethical approval was obtained. Responses were analysed using multiple regression in SPSS."
              </p>
            </div>
          </div>

          <h3 style={{ fontSize: 20, marginTop: 32, marginBottom: 12 }}>What to include:</h3>
          <ul style={{ display: "grid", gap: 12, fontSize: 16, color: "var(--graphite)", paddingLeft: 20 }}>
            <li><strong>Sample Size & Method:</strong> "250 students", "stratified random sampling".</li>
            <li><strong>Instruments:</strong> "40-item questionnaire", "semi-structured interviews".</li>
            <li><strong>Analysis:</strong> "multiple regression", "thematic analysis".</li>
            <li><strong>Decision Gates:</strong> "If the response rate is below 50%, a reminder is sent."</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>3. The PDF Upload (Pro)</h2>
          <p style={{ fontSize: 16, color: "var(--graphite)" }}>
            Instead of typing, Pro users can drag and drop a <strong>PDF or DOCX</strong> research proposal into the editor. The AI will automatically scan the document, extract the methodology chapter, and generate the flowchart. This is perfect for long, complex proposals.
          </p>
        </section>

        {/* Section 4 */}
        <section style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>4. Refining with AI</h2>
          <p style={{ fontSize: 16, color: "var(--graphite)" }}>
            The first draft doesn't have to be perfect. Use the <strong>Refine with AI</strong> box to make surgical changes. You don't need to regenerate the whole diagram.
          </p>
          <ul style={{ display: "grid", gap: 12, fontSize: 16, color: "var(--graphite)", paddingLeft: 20, marginTop: 16 }}>
            <li>"Add a decision gate for missing data after the data collection step."</li>
            <li>"Combine the two analysis steps into one node."</li>
            <li>"Change the start terminator to say 'Project Initiation'."</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 28, marginBottom: 16 }}>5. Exporting for your Thesis</h2>
          <div style={{ display: "grid", gap: 16, fontSize: 16, color: "var(--graphite)" }}>
            <p><strong>Word (.docx):</strong> Exports the diagram perfectly sized for A4, along with a caption. Note: You can edit the caption to remove the "Figure 1" numbering if you are managing your own figure numbers.</p>
            <p><strong>LaTeX (TikZ):</strong> If you are using Overleaf, copy the TikZ code into your document. It renders a 100% vector diagram that scales infinitely.</p>
            <p><strong>PNG/PDF:</strong> Best for quick previews or inserting into slides.</p>
          </div>
        </section>

        <div style={{ textAlign: "center", marginTop: 64 }}>
          <Link href="/app" className="btn pri" style={{ padding: "12px 24px", fontSize: 18 }}>
            Open the Editor
          </Link>
        </div>

      </main>
      <Footer />
    </>
  );
}
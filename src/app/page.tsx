import Link from "next/link";
import { Header, Footer } from "@/components/Chrome";
import { TEMPLATES } from "@/lib/templates";
import { toSVG } from "@/lib/export/svg";
import { SITE } from "@/lib/site";

const FAQ = [
  [
    "What is MethodFlow AI?",
    "MethodFlow AI is the methodology engine inside MethodFlow. It reads your methods, maps the stages your design requires, and writes a structured, editable flowchart — phases, decision gates, labelled branches and integration points.",
  ],
  [
    "What is a methodology flowchart?",
    "A diagram that shows the stages of your research in order: from problem definition through sampling and data collection to analysis and reporting. Supervisors and examiners use it to check that your design is coherent.",
  ],
  [
    "Can I paste the result into Word or LaTeX?",
    "Yes. Word export places the figure with an automatically numbered caption. LaTeX users can copy TikZ code. Vector PDF, PNG and SVG are also available.",
  ],
  [
    "How accurate is the generated diagram?",
    "MethodFlow AI follows the conventions of your chosen design and the details you provide, but the result is a draft. Check every step against your own method before submitting.",
  ],
  [
    "Do I need an account?",
    "No. You can generate, edit and export diagrams for free without signing up. An account lets you manage a Pro plan and save diagrams to the cloud.",
  ],
  [
    "Is my methodology text stored?",
    "Text you submit is processed by MethodFlow AI to produce the diagram and is not kept in our database. If you click 'Save to Cloud', the finished diagram is stored securely on your account.",
  ],
];

const ld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "MethodFlow AI",
      alternateName: SITE.name,
      url: SITE.url,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any",
      description: SITE.desc,
      publisher: { "@type": "Organization", name: SITE.parent, url: SITE.parentUrl },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function Home() {
  const t = TEMPLATES[0];
  const { svg } = toSVG(t.ir);

  return (
    <>
      <Header />
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
        />
        <div className="wrap">
          <section className="hero">
            <div>
              <h1>Methodology flowcharts, drawn to thesis standard.</h1>
              <p>
                MethodFlow AI turns your research design into an editable, thesis-ready flowchart — phases, decision gates,
                labelled branches and integration points — then exports it to Word, PDF, SVG or LaTeX with a numbered caption.
              </p>
              <div className="acts">
                <Link className="btn" href="/app">Open the editor</Link>
                <Link className="btn ghost" href="/pricing">See pricing</Link>
              </div>
            </div>
            <figure className="plate" style={{ margin: 0 }}>
              <div role="img" aria-label={t.title} dangerouslySetInnerHTML={{ __html: svg }} />
              <figcaption>Figure 1. {t.title}, as exported by MethodFlow AI.</figcaption>
            </figure>
          </section>

          <section className="sec">
            <h2>What you get</h2>
            <div className="cols">
              <div>
                <h3>Draft with MethodFlow AI</h3>
                <p>
                  Paste your methodology or upload a document. MethodFlow AI returns a structured draft — not a generic
                  template — with the stages, decisions and branches your design actually uses.
                </p>
              </div>
              <div>
                <h3>Start from a standard</h3>
                <p>
                  PRISMA 2020, CONSORT, quantitative, qualitative, mixed methods and design science templates with the
                  conventional stages already in place.
                </p>
              </div>
              <div>
                <h3>Export for your thesis</h3>
                <p>
                  Word with an auto-numbered caption, vector PDF, PNG, SVG, Mermaid and LaTeX (TikZ). Print-safe page fitting,
                  visible arrowheads, black-and-white or light tints.
                </p>
              </div>
            </div>
          </section>

          <section className="sec">
            <h2>Why MethodFlow AI</h2>
            <div className="cols">
              <div>
                <h3>Built for methods chapters</h3>
                <p>
                  The engine knows the conventions of reviews, trials, qualitative studies, mixed methods, machine-learning
                  pipelines and spatial workflows — and preserves your sample sizes, thresholds and named methods.
                </p>
              </div>
              <div>
                <h3>Print-safe, not slide-safe</h3>
                <p>
                  Automatic page fitting, A4/A3 promotion, distinct arrowheads and phase-aware routing. The figure is designed to
                  survive a thesis print, not just a screen.
                </p>
              </div>
              <div>
                <h3>You stay in control</h3>
                <p>
                  Every output is an editable draft: rename steps, fix the logic, change phases and layout. Verify everything
                  against your own method before it goes to your supervisor.
                </p>
              </div>
            </div>
          </section>

          <section className="sec">
            <h2>How it works</h2>
            <ol className="steps">
              <li><strong>Describe or choose.</strong> Paste your method or open a template — MethodFlow AI detects the design or uses the one you picked.</li>
              <li><strong>Edit.</strong> Rename steps, change shapes, add decisions, group steps into phases. Undo and redo are always available.</li>
              <li><strong>Export.</strong> Download the figure in the format your thesis template needs.</li>
            </ol>
          </section>

          <section className="sec">
            <h2>Templates</h2>
            <ul className="tlist">
              {TEMPLATES.map((x) => (
                <li key={x.slug}>
                  <Link href={`/templates/${x.slug}`}>
                    {x.title}
                    <span>{x.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="sec">
            <h2>Your work stays with you</h2>
            <p>
              Drafts autosave in your browser as you work. Cloud save and the dashboard are available on Pro — start free,
              upgrade when your methods chapter is ready.
            </p>
          </section>

          <section className="sec" style={{ textAlign: "center" }}>
            <h2>Ready to lose the flowchart fight?</h2>
            <p style={{ maxWidth: 560, margin: "0 auto 20px" }}>
              Draft your first diagram free with MethodFlow AI. Upgrade to Pro when you want the deeper engine, document upload
              and watermark-free exports.
            </p>
            <div className="acts" style={{ justifyContent: "center" }}>
              <Link href="/app" className="btn">Start free</Link>
              <Link href="/pricing" className="btn ghost">Compare plans</Link>
            </div>
          </section>

          <section className="sec faq">
            <h2>Questions</h2>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

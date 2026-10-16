# MethodFlow

Methodology flowchart maker for theses and research papers.

Live: **https://methodflow.geodesia.online**

A web tool that turns a research methodology paragraph into an editable, thesis-ready flowchart. Built for students, supervisors, and researchers who need PRISMA, CONSORT, quantitative, qualitative, and mixed-methods diagrams that export cleanly to Word, PDF, SVG, and LaTeX.

---

## What it does

- **Generate from text.** Paste a methodology paragraph, pick a research design, get an editable draft diagram in 5–15 seconds.
- **Start from a template.** Six built-in templates: quantitative, qualitative, mixed methods, PRISMA 2020, CONSORT, design science.
- **Edit on a canvas.** Rename steps, change shapes, add decisions, group steps into phases, undo/redo, auto-layout.
- **Style.** Six curated colour palettes (black-and-white, grayscale, tint, colourblind-safe, pastel, bold). Per-node and per-phase colour overrides. Three density levels.
- **Auto-orient.** Diagrams choose top-to-bottom or left-to-right automatically based on aspect ratio, so they fit a page without becoming unreadable.
- **Export.** PNG, SVG, PDF, Word (.docx with a numbered caption), Mermaid, LaTeX (TikZ), and JSON. Page size, orientation, margin, and font are selectable.
- **Share.** Create a read-only link kept for 90 days.

---

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values marked "INPUT NEEDED"
npm run dev                  # http://localhost:3000
npm test                     # vitest: schema, validation, exporters, escaping
npm run typecheck
npm run build
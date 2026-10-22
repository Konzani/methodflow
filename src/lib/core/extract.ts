/**
 * Document preparation for uploads and long pasted text.
 *
 * The old pipeline kept the FIRST 25,000 characters of a document. In a thesis the
 * methodology chapter usually starts well after that, so the model was being shown
 * the introduction and literature review (which the prompt then tells it to ignore).
 * Here we locate the methodology section first, and only fall back to keyword
 * density when no clear chapter exists.
 */

// Words that signal methodology content (used to score chunks in the fallback)
const KEYWORDS =
  /\b(?:sampl\w*|population|participants?|respondents?|questionnaire|survey\w*|interview\w*|focus groups?|observation\w*|instrument\w*|pilot\w*|reliab\w*|validit\w*|cronbach\w*|ethic\w*|consent|data collection|collected|analy[sz]\w*|regression|anova|t-test|correlation|thematic|coding|transcri\w*|triangulat\w*|saturation|inclusion|exclusion|screening|search strategy|databases?|randomi[sz]\w*|intervention|control group|artefact|artifact|prototype|procedure\w*|phase|stage)\b/gi;

// "Chapter 3 ...", "3 Methodology", "Research design and methodology", "Materials and methods" ...
// Numbered sub-sections such as "3.2 Research design" deliberately do NOT match.
const START =
  /^[ \t]*(?:chapter\s+(?:3|three|iii)\b[^\n]{0,80}|(?:\d{1,2}(?:\.0)?[.)]?\s+)?(?:research\s+)?(?:methodology|methods?|materials?\s+and\s+methods?|research\s+design(?:\s+and\s+(?:methodology|methods))?|study\s+design(?:\s+and\s+methods?)?)[ \t]*)$/gim;

// The heading that closes the methodology: Chapter 4/5, Results, Findings, Discussion ...
const END =
  /^[ \t]*(?:chapter\s+(?:4|four|iv|5|five|v)\b[^\n]{0,80}|(?:\d{1,2}(?:\.0)?[.)]?\s+)?(?:results?(?:\s+and\s+discussion)?|findings|data\s+presentation(?:\s+and\s+analysis)?|discussion|conclusions?)[ \t]*)$/gim;

/** Normalise text extracted from PDF / DOCX / TXT. */
export function cleanDocument(raw: string): string {
  let t = raw.replace(/\r\n?/g, "\n").replace(/\f/g, "\n");
  t = t.replace(/(\w)-\n(?=[a-z])/g, "$1"); // re-join words hyphenated across lines
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\.{4,}\s*\d+/g, ""); // table-of-contents leaders
  t = t.replace(/^\s*(?:page\s+)?\d+(?:\s+of\s+\d+)?\s*$/gim, ""); // bare page numbers

  // drop running headers/footers (identical short lines repeated on many pages),
  // but never drop chapter / numbered headings
  const lines = t.split("\n");
  const freq = new Map<string, number>();
  for (const l of lines) {
    const k = l.trim();
    if (k.length > 3 && k.length < 90) freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  t = lines
    .filter((l) => (freq.get(l.trim()) ?? 0) < 5 || /^(chapter\b|\d+(\.\d+)*\s)/i.test(l.trim()))
    .join("\n");

  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function chunks(text: string, size = 900): string[] {
  const parts = text
    .split(/\n{2,}/)
    .flatMap((p) => (p.length > size * 1.6 ? p.split(/(?<=[.!?])\s+/) : [p]));
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length > size) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Keep `head` verbatim, then fill the budget with the most methodology-dense chunks, in original order. */
function densest(text: string, budget: number, headChars: number): string {
  const head = text.slice(0, headChars);
  const scored = chunks(text.slice(headChars))
    .map((c, i) => {
      const hits = c.match(KEYWORDS)?.length ?? 0;
      const years = c.match(/\b(?:19|20)\d{2}\b/g)?.length ?? 0; // citation-heavy chunks are literature review
      return { i, c, s: years > 8 ? hits * 0.3 : hits };
    })
    .sort((a, b) => b.s - a.s);

  const picked: typeof scored = [];
  let used = head.length;
  for (const x of scored) {
    if (used + x.c.length > budget) continue;
    picked.push(x);
    used += x.c.length;
  }
  picked.sort((a, b) => a.i - b.i);
  return [head, ...picked.map((x) => x.c)].filter(Boolean).join("\n\n");
}

/** Longest stretch between a methodology-style heading and the next results-style heading. */
function bestSection(text: string): string | null {
  const ends = [...text.matchAll(END)].map((m) => m.index ?? 0);
  let best: string | null = null;
  for (const m of text.matchAll(START)) {
    const s = m.index ?? 0;
    const e = ends.find((x) => x > s) ?? text.length;
    // table-of-contents entries produce tiny sections, so the length floor skips them
    if (e - s >= 1500 && (!best || e - s > best.length)) best = text.slice(s, e);
  }
  return best;
}

export type Focus = { text: string; mode: "full" | "section" | "keywords" };

export function focusMethodology(text: string, budget = 14000): Focus {
  if (text.length <= budget) return { text, mode: "full" };
  const sec = bestSection(text);
  if (sec) return { text: sec.length <= budget ? sec : densest(sec, budget, 2500), mode: "section" };
  return { text: densest(text, budget, 1500), mode: "keywords" };
}
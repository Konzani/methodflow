import type { IR } from "./ir";

/**
 * Soft quality rubric. validateGraph() answers "is this graph structurally legal?".
 * This answers "is it a GOOD methodology diagram?". Each returned string is written
 * so it can be pasted straight back to the model as feedback.
 */
export type QualityOpts = {
  method: string;
  /** true when the user supplied a real description (not just a methodology name) */
  rich: boolean;
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quote = (ns: { label: string }[]) => ns.slice(0, 4).map((n) => `"${n.label}"`).join(", ");

// Nodes that are results/measurements rather than actions or gates
const VALUE_LABEL: RegExp[] = [
  /^\s*n\s*=\s*\d/i,
  /^\s*\d[\d.,]*\s*(%|participants?|respondents?|items?|samples?|records?|studies|articles?|interviews?)\b/i,
  /(alpha|α)\s*[=:]?\s*0?\.\d+/i,
  /^\s*response rate\b/i,
  /^\s*p\s*[<=>]\s*0?\.\d+/i,
];

// Nodes that only name a software tool
const TOOL_ONLY =
  /^(spss|nvivo|atlas\.?ti|maxqda|stata|sas|excel|python|r|smartpls|amos|matlab|qgis|arcgis|eviews|jamovi|dedoose)(\s+(software|package|v?\d+(\.\d+)*))?$/i;

// Labels so generic they could belong to any study
const GENERIC =
  /^(collect data|data collection|analy[sz]e data|data analysis|analy[sz]e results|methodology|results|conclusion|discussion|research design|sampling|literature review)$/i;

// Gates a study of this type normally contains (ethics, validation, screening ...)
const MIN_DECISIONS: Record<string, number> = {
  quantitative: 1,
  qualitative: 1,
  mixed: 1,
  prisma: 2,
  consort: 1,
  dsr: 1,
};

// Methodologies whose flows legitimately do not begin/end on terminators
const NO_TERMINATORS = new Set(["prisma", "consort"]);

export function qualityIssues(ir: IR, o: QualityOpts): string[] {
  const out: string[] = [];
  const { nodes, edges, groups } = ir;

  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const e of edges) {
    outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  // 1. values / tool names masquerading as steps
  const values = nodes.filter((n) => VALUE_LABEL.some((rx) => rx.test(n.label)) || TOOL_ONLY.test(n.label.trim()));
  if (values.length) {
    out.push(
      `Nodes that are values or tool names, not actions or gates: ${quote(values)}. Fold the detail into the label of the step it belongs to, or delete the node.`
    );
  }

  // 2. label hygiene
  const badLabel = nodes.filter((n) => {
    const w = words(n.label);
    const l = n.label.trim();
    const isDecision = n.shape === "decision";
    return w > 8 || (w < 2 && !isDecision) || /[.;:,!]$/.test(l) || (!isDecision && /\?$/.test(l));
  });
  if (badLabel.length) {
    out.push(
      `Labels must be 2-7 words, sentence case, no trailing punctuation (a question mark is allowed only on decisions): ${quote(badLabel)}.`
    );
  }

  // 3. duplicates
  const seen = new Map<string, number>();
  for (const n of nodes) {
    const k = n.label.trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dup = [...seen].filter(([, c]) => c > 1).map(([k]) => `"${k}"`);
  if (dup.length) out.push(`Duplicate labels: ${dup.slice(0, 4).join(", ")}. Give every step a distinct, specific label.`);

  // 4. entry / exit nodes
  if (!NO_TERMINATORS.has(o.method)) {
    const bad = nodes.filter(
      (n) => ((indeg.get(n.id) ?? 0) === 0 || (outdeg.get(n.id) ?? 0) === 0) && n.shape !== "terminator"
    );
    if (bad.length) out.push(`The flow must start and end on terminator nodes; these entry/exit nodes are not terminators: ${quote(bad)}.`);
  }

  // 5. groups
  if (groups.length < 2 || groups.length > 5) out.push(`Use 2 to 5 groups (study phases); there are ${groups.length}.`);
  const sizes = new Map<string, number>();
  for (const n of nodes) if (n.groupId) sizes.set(n.groupId, (sizes.get(n.groupId) ?? 0) + 1);
  const thin = groups.filter((g) => (sizes.get(g.id) ?? 0) < 2);
  if (thin.length) {
    out.push(
      `These groups hold fewer than 2 nodes; merge them into a neighbouring phase or add the steps the text describes: ${thin.map((g) => `"${g.label}"`).join(", ")}.`
    );
  }
  if (nodes.some((n) => !n.groupId)) out.push("Every node needs a groupId.");

  // 6. gates
  const decisions = nodes.filter((n) => n.shape === "decision").length;
  const need = MIN_DECISIONS[o.method] ?? 0;
  if (decisions < need) {
    out.push(
      `Only ${decisions} decision gate(s); a ${o.method} study normally has at least ${need} (for example ethics approval, instrument validation, screening). Add gates the text states or the method cannot proceed without. Do not invent others.`
    );
  }

  // 7. size
  const max = NO_TERMINATORS.has(o.method) ? 24 : 20;
  if (nodes.length > max) out.push(`Too many nodes (${nodes.length}); merge minor steps to stay at ${max} or fewer.`);
  if (o.rich && nodes.length < 10) {
    out.push(`Only ${nodes.length} nodes for a detailed description; expand the stages the text describes (aim for 10 or more) without inventing steps.`);
  }

  // 8. genericness (only meaningful when the user gave real detail)
  if (o.rich) {
    const generic = nodes.filter((n) => GENERIC.test(n.label.trim()));
    if (generic.length >= 2) {
      out.push(
        `Generic labels: ${quote(generic)}. Replace them with the specifics from the text (sampling technique, instrument, interview type, statistical test, design name).`
      );
    }
  }

  return out;
}
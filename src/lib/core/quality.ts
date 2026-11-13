import type { IR } from "./ir";
import { LIMITS } from "./limits";

export type QualityOpts = {
  method: string;
  rich: boolean;
  source?: string;
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quote = (ns: { label: string }[]) => ns.slice(0, 4).map((n) => `"${n.label}"`).join(", ");

const VALUE_LABEL: RegExp[] = [
  /^\s*n\s*=\s*\d/i,
  /^\s*\d[\d.,]*\s*(%|participants?|respondents?|items?|samples?|records?|studies|articles?|interviews?)\b/i,
  /(alpha|α)\s*[=:]?\s*0?\.\d+/i,
  /^\s*response rate\b/i,
  /^\s*p\s*[<=>]\s*0?\.\d+/i,
];

const TOOL_ONLY =
  /^(spss|nvivo|atlas\.?ti|maxqda|stata|sas|excel|python|r|smartpls|amos|matlab|qgis|arcgis|eviews|jamovi|dedoose)(\s+(software|package|v?\d+(\.\d+)*))?$/i;

const GENERIC =
  /^(collect data|data collection|analy[sz]e data|data analysis|analy[sz]e results|methodology|results|conclusion|discussion|research design|sampling|literature review)$/i;

// Labels that only describe the drawing ("Split into three evidence streams") rather than
// the research method. A thesis figure forking should use labelled branch edges instead.
const META_LABEL =
  /^(split|merge|combine|branch|divide|separate|join|fork)\b[^.]*\b(branches?|streams?|sub-?branches?|paths?|strands?|workflows?)\b/i;

const MIN_DECISIONS: Record<string, number> = {
  prisma: 2,
  consort: 1,
  dsr: 1,
};

const NO_TERMINATORS = new Set(["prisma", "consort"]);

const TERMINAL_OUTCOME =
  /\b(exclu\w*|reject\w*|withdr\w*|discontinu\w*|ineligible|not eligible|not retrieved|lost to follow|stop\w*|terminat\w*|abandon\w*)\b/i;

const PARALLEL_CUE =
  /\b(parallel(?:ly)?|simultaneous(?:ly)?|concurrent(?:ly)?|convergent|multi-model|ensemble|in tandem|independent (?:strands?|arms?|streams?|analys[ei]s)|two (?:strands|arms|streams)|both (?:strands|arms|streams))\b/i;

const NUM = /\d+(?:[.,]\d+)*/g;
const normNum = (t: string) => (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, "") : t.replace(",", "."));

function numbersOf(s: string): Set<string> {
  const cleaned = s
    .replace(/\[\d+(?:\s*[,–-]\s*\d+)*\]/g, " ")
    .replace(/^\s*\d+(?:\.\d+)*[.)]?\s+(?=\p{L})/gmu, "");
  return new Set((cleaned.match(NUM) ?? []).map(normNum).filter((n) => !/^\d$/.test(n)));
}

export function numberFidelity(ir: IR, source: string): { invented: string[]; missing: string[] } {
  const src = numbersOf(source);
  const diagram = numbersOf(
    [
      ir.meta.title,
      ir.meta.caption ?? "",
      ...ir.groups.map((g) => g.label),
      ...ir.nodes.map((n) => n.label),
      ...ir.edges.map((e) => e.label ?? ""),
    ].join("\n")
  );
  return {
    invented: [...diagram].filter((n) => !src.has(n)),
    missing: [...src].filter((n) => !diagram.has(n)),
  };
}

export function qualityIssues(ir: IR, o: QualityOpts): string[] {
  const out: string[] = [];
  const { nodes, edges, groups } = ir;

  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  for (const e of edges) {
    outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const values = nodes.filter((n) => VALUE_LABEL.some((rx) => rx.test(n.label)) || TOOL_ONLY.test(n.label.trim()));
  if (values.length) {
    out.push(
      `Nodes that are values or tool names, not actions or gates: ${quote(values)}. Fold the detail into the label of the step it belongs to, or delete the node.`
    );
  }

  const meta = nodes.filter((n) => META_LABEL.test(n.label.trim()));
  if (meta.length) {
    out.push(
      `Labels that describe the diagram instead of the method: ${quote(meta)}. Delete these steps and fork directly; put the branch name on each outgoing edge instead.`
    );
  }

  const forks = nodes.filter((n) => n.shape !== "decision" && (outdeg.get(n.id) ?? 0) >= 2);
  const unlabelled = forks.filter((n) => edges.filter((e) => e.source === n.id).every((e) => !e.label));
  if (unlabelled.length) {
    out.push(
      `Fork steps without labelled branches: ${quote(unlabelled)}. Label each outgoing edge with the name of its branch or sub-branch.`
    );
  }

  const badLabel = nodes.filter((n) => {
    const w = words(n.label);
    const l = n.label.trim();
    const dec = n.shape === "decision";
    const term = n.shape === "terminator";
    return w > LIMITS.labelWordsMax || l.length > LIMITS.labelCharsMax || (w < 2 && !dec && !term) || /[.;:,!]$/.test(l) || (!dec && /\?$/.test(l));
  });
  if (badLabel.length) {
    out.push(
      `Labels should be about ${LIMITS.labelWords[0]}-${LIMITS.labelWords[1]} words (never more than ${LIMITS.labelWordsMax}), sentence case, with no trailing punctuation; a question mark is allowed only on decisions: ${quote(badLabel)}.`
    );
  }

  const seen = new Map<string, number>();
  for (const n of nodes) {
    const k = n.label.trim().toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dup = [...seen].filter(([, c]) => c > 1).map(([k]) => `"${k}"`);
  if (dup.length) out.push(`Duplicate labels: ${dup.slice(0, 4).join(", ")}. Give every step a distinct, specific label.`);

  const caption = (ir.meta.caption ?? "").trim();
  if (!caption) {
    out.push("Add a one-sentence caption in meta.caption that says what the figure shows, without results.");
  } else if (/^\s*(fig(?:ure|\.)|table)\b/i.test(caption) || /^\s*(fig(?:ure|\.))\s*\d/i.test(ir.meta.title)) {
    out.push('The title and caption must not contain figure numbering such as "Figure 1"; the document supplies the number.');
  }

  if (!NO_TERMINATORS.has(o.method)) {
    const bad = nodes.filter((n) => {
      if (n.shape !== "process" && n.shape !== "decision") return false;
      const entry = (indeg.get(n.id) ?? 0) === 0;
      const exit = (outdeg.get(n.id) ?? 0) === 0;
      if (entry) return true;
      return exit && !TERMINAL_OUTCOME.test(n.label);
    });
    if (bad.length) out.push(`The flow must start and end on terminator nodes; these entry or exit nodes are not terminators: ${quote(bad)}.`);
  }

  if (groups.length < LIMITS.groups[0] || groups.length > LIMITS.groups[1]) {
    out.push(`Use ${LIMITS.groups[0]} to ${LIMITS.groups[1]} groups (study phases), normally ${LIMITS.groupsTypical[0]} to ${LIMITS.groupsTypical[1]}; there are ${groups.length}.`);
  }
  const sizes = new Map<string, number>();
  for (const n of nodes) if (n.groupId) sizes.set(n.groupId, (sizes.get(n.groupId) ?? 0) + 1);
  const thin = groups.filter((g) => (sizes.get(g.id) ?? 0) < 2);
  if (thin.length) {
    out.push(
      `These groups hold fewer than 2 nodes; merge them into a neighbouring phase or add the steps the text describes: ${thin.map((g) => `"${g.label}"`).join(", ")}.`
    );
  }
  if (nodes.some((n) => !n.groupId)) out.push("Every node needs a groupId.");

  const decisions = nodes.filter((n) => n.shape === "decision").length;
  const need = MIN_DECISIONS[o.method] ?? 0;
  if (decisions < need) {
    out.push(
      `Only ${decisions} decision gate(s); a ${o.method} flow normally has at least ${need}. Add the gates the method requires. Do not invent thresholds or steps the text does not support.`
    );
  }

  if (nodes.length > LIMITS.softMaxNodes) {
    out.push(`Too many nodes (${nodes.length}); merge minor steps to stay at ${LIMITS.softMaxNodes} or fewer.`);
  }
  if (o.rich && nodes.length < LIMITS.minRichNodes) {
    out.push(`Only ${nodes.length} nodes for a detailed description; expand the stages the text describes (aim for ${LIMITS.proNodes[0]} or more) without inventing steps.`);
  }

  if (o.source && PARALLEL_CUE.test(o.source)) {
    const forks = nodes.filter((n) => n.shape !== "decision" && (outdeg.get(n.id) ?? 0) >= 2);
    if (!forks.length) {
      out.push(
        "The text describes parallel or convergent strands, but the diagram is a single chain. Branch from one step into each strand and join the strands at an integration step."
      );
    }
  }

  if (o.source && o.source.trim().length >= 40) {
    const { invented, missing } = numberFidelity(ir, o.source);
    if (invented.length) {
      out.push(
        `These numbers do not appear in the user's text: ${invented.slice(0, 6).join(", ")}. Remove them or replace them with figures actually stated.`
      );
    }
    if (missing.length) {
      out.push(
        `Numbers stated in the user's text that are missing from the diagram: ${missing.slice(0, 6).join(", ")}. Add each number to the label of the step it describes.`
      );
    }
  }

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

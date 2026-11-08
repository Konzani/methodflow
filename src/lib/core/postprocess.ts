import type { IR, N } from "./ir";

const REVISION =
  /^(revis\w*|redo|retry|rework\w*|recalibrat\w*|reassess\w*|repeat\w*|re-?(collect|test|run|pilot|sample|train|design|code|measure|tune))\b/i;

const isRevision = (n: N | undefined): boolean => !!n && REVISION.test(n.label.trim());

function reaches(from: string, to: string, adj: Map<string, string[]>): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const u = stack.pop()!;
    if (u === to) return true;
    if (seen.has(u)) continue;
    seen.add(u);
    for (const w of adj.get(u) ?? []) stack.push(w);
  }
  return false;
}

const COMPLEMENT: Record<string, string> = { yes: "No", no: "Yes" };
const complement = (label: string) => COMPLEMENT[label.trim().toLowerCase()] ?? "Otherwise";

export function labelDecisionBranches(ir: IR): IR {
  const edges = ir.edges.map((e) => ({ ...e }));
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);

  for (const d of ir.nodes) {
    if (d.shape !== "decision") continue;
    const out = edges.filter((e) => e.source === d.id);
    if (out.length < 2) continue;
    const [a, b] = out;

    if (a.label && !b.label) b.label = complement(a.label);
    else if (b.label && !a.label) a.label = complement(b.label);
    else if (!a.label && !b.label) {
      const aLoops = reaches(a.target, d.id, adj);
      const bLoops = reaches(b.target, d.id, adj);
      if (bLoops && !aLoops) {
        a.label = "Yes";
        b.label = "No";
      } else if (aLoops && !bLoops) {
        a.label = "No";
        b.label = "Yes";
      } else {
        a.label = "Yes";
        b.label = "No";
      }
    }
  }
  return { ...ir, edges };
}

export function fixTopology(ir: IR): IR {
  const labelled = labelDecisionBranches(ir);
  const nodes = labelled.nodes.map((n) => ({ ...n }));
  const edges = labelled.edges.map((e) => ({ ...e }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  for (const rev of nodes) {
    if (!isRevision(rev)) continue;
    if (edges.some((e) => e.source === rev.id)) continue;
    const gateEdge = edges.find((e) => e.target === rev.id && byId.get(e.source)?.shape === "decision");
    if (!gateEdge) continue;
    const feeder = edges.find((e) => e.target === gateEdge.source && e.source !== rev.id);
    edges.push({
      id: `e_${rev.id}_loop`,
      source: rev.id,
      target: feeder ? feeder.source : gateEdge.source,
    });
  }

  const seen = new Set<string>();
  const deduped = edges.filter((e) => {
    const key = `${e.source}>${e.target}>${e.label ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ...labelled, nodes, edges: deduped };
}

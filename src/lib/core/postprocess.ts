import type { IR, N, E } from "./ir";

/** Labels that indicate a revision / retry node. */
const REVISION = /^(revise|redo|retry|rework|correct|adjust|remove|refine|re-?do|re-?collect|re-?test|re-?run)\b/i;

/** True if the node is a revision/retry step. */
const isRevision = (n: N | undefined): boolean =>
  !!n && REVISION.test(n.label.trim());

/**
 * Fix graph topology deterministically:
 *  1. Every decision has exactly two outgoing edges.
 *  2. Every outgoing edge from a decision is labelled Yes/No (or an equivalent).
 *  3. Every revision node loops BACK to the decision that gates it.
 *  4. Orphan revision nodes (no gate) are rewired backward to the nearest
 *     upstream non-revision node.
 */
export function fixTopology(ir: IR): IR {
  const nodes = ir.nodes.map((n) => ({ ...n }));
  const edges = ir.edges.map((e) => ({ ...e }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // ── Rule 1 & 2: label decision branches ───────────────────────────
  for (const d of nodes) {
    if (d.shape !== "decision") continue;
    const out = edges.filter((e) => e.source === d.id);
    if (out.length === 0) continue;

    if (out.length === 1) {
      out[0].label = out[0].label ?? "Yes";
      continue;
    }

    // Two or more — pick the two most likely to be Yes/No
    // The one going to a revision node → "No". The other → "Yes".
    if (out.length >= 2) {
      const [a, b] = out;
      const aRev = isRevision(nodeById.get(a.target));
      const bRev = isRevision(nodeById.get(b.target));

      if (aRev && !bRev) {
        a.label = a.label ?? "No";
        b.label = b.label ?? "Yes";
      } else if (bRev && !aRev) {
        b.label = b.label ?? "No";
        a.label = a.label ?? "Yes";
      } else {
        // Neither clearly revision — assign Yes to the first, No to the second
        a.label = a.label ?? "Yes";
        b.label = b.label ?? "No";
      }
    }
  }

  // ── Rule 3: rewire revision loops to point back to their gate ─────
  for (const rev of nodes) {
    if (!isRevision(rev)) continue;

    // Find the decision that points at this revision node.
    const gateEdge = edges.find(
      (e) => e.target === rev.id && nodeById.get(e.source)?.shape === "decision",
    );
    if (!gateEdge) continue; // not gated by a decision — handled by Rule 4
    const gate = nodeById.get(gateEdge.source);
    if (!gate) continue;

    // Retarget the revision node's outgoing edge(s) to point back at the gate.
    const revOut = edges.filter((e) => e.source === rev.id);
    if (revOut.length === 0) {
      // Add a new loop edge
      edges.push({
        id: `e_${rev.id}_loop`,
        source: rev.id,
        target: gate.id,
      });
    } else {
      // Retarget the first outgoing edge to the gate; drop any extras
      revOut[0].target = gate.id;
      revOut[0].label = undefined;
      for (let i = 1; i < revOut.length; i++) {
        revOut[i].target = gate.id;
        revOut[i].label = undefined;
      }
    }
  }

  // ── Rule 4: orphan revision nodes ─────────────────────────────────
  // A revision node not gated by a decision still should loop back.
  for (const rev of nodes) {
    if (!isRevision(rev)) continue;
    const gated = edges.some(
      (e) => e.target === rev.id && nodeById.get(e.source)?.shape === "decision",
    );
    if (gated) continue;

    // Find any incoming edge (from a non-decision)
    const inEdge = edges.find((e) => e.target === rev.id);
    if (!inEdge) continue;
    const upstream = nodeById.get(inEdge.source);
    if (!upstream) continue;

    // Point the revision node back at the upstream node it came from.
    const revOut = edges.find((e) => e.source === rev.id);
    if (revOut) {
      revOut.target = upstream.id;
      revOut.label = undefined;
    } else {
      edges.push({
        id: `e_${rev.id}_loop`,
        source: rev.id,
        target: upstream.id,
      });
    }
  }

  // ── Deduplicate edges ─────────────────────────────────────────────
  const seen = new Set<string>();
  const deduped = edges.filter((e) => {
    const key = `${e.source}>${e.target}>${e.label ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ...ir, nodes, edges: deduped };
}
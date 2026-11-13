import { describe, expect, it } from "vitest";
import { useDiagram } from "@/stores/diagram";
import { emptyIR } from "@/lib/core/ir";
import { TEMPLATES } from "@/lib/templates";

describe("new project reset", () => {
  it("clears the previous diagram, selection and undo history", () => {
    const store = useDiagram.getState();
    store.load(TEMPLATES[0].ir);
    const before = useDiagram.getState();
    expect(before.ir.nodes.length).toBeGreaterThan(1);
    before.select({ k: "n", id: before.ir.nodes[0].id });
    before.patchTitle("Old project title"); // adds an undo entry

    useDiagram.getState().newProject();
    const s = useDiagram.getState();
    expect(s.ir.nodes.length).toBe(1);
    expect(s.ir.nodes[0]).toMatchObject({ id: "n1", shape: "terminator" });
    expect(s.ir.meta.title).toBe(emptyIR().meta.title);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.sel).toBeNull();
  });

  it("can start a new project from a template", () => {
    useDiagram.getState().load(TEMPLATES[2].ir);
    useDiagram.getState().newProject(TEMPLATES[1].ir);
    const s = useDiagram.getState();
    expect(s.ir.nodes.length).toBe(TEMPLATES[1].ir.nodes.length);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
  });
});

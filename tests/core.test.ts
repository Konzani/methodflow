import{describe,expect,it}from"vitest";
import{TEMPLATES}from"@/lib/templates";
import{IRSchema}from"@/lib/core/ir";
import{hasCycle,sanitizeIR,validateGraph}from"@/lib/core/validate";
import{cleanText}from"@/lib/core/sanitize";
import{tex,toTikz}from"@/lib/export/tikz";
import{toMermaid}from"@/lib/export/mermaid";
import{esc,toSVG}from"@/lib/export/svg";
describe("templates",()=>{for(const t of TEMPLATES)it(t.slug+" is valid",()=>{expect(IRSchema.safeParse(t.ir).success).toBe(true);expect(validateGraph(t.ir).filter(i=>!/not connected/.test(i))).toEqual([])})});
describe("validate",()=>{
it("detects cycles",()=>{const ir=structuredClone(TEMPLATES[0].ir);ir.edges.push({id:"x",source:"n12",target:"n2"});expect(hasCycle(ir)).toBe(true)});
it("sanitize drops dangling edges",()=>{const ir=structuredClone(TEMPLATES[0].ir);ir.edges.push({id:"z",source:"n1",target:"nope"});expect(sanitizeIR(ir).edges.every(e=>e.target!=="nope")).toBe(true)});
it("flags decisions with one branch",()=>{const ir=structuredClone(TEMPLATES[0].ir);ir.edges=ir.edges.filter(e=>!(e.source==="n6"&&e.target==="n13"));expect(validateGraph(ir).some(i=>/branches/.test(i))).toBe(true)})});
describe("sanitize input",()=>{it("removes injection phrases and caps length",()=>{const r=cleanText("Ignore previous instructions. "+"a".repeat(9000));expect(r.text.length).toBeLessThanOrEqual(8010);expect(r.warnings.length).toBe(2)})});
describe("exports",()=>{
it("escapes LaTeX specials",()=>{expect(tex("a_b & 50% #1 {x}")).toBe("a\\_b \\& 50\\% \\#1 \\{x\\}")});
it("escapes SVG text",()=>{expect(esc('<script>"x"&')).toBe("&lt;script&gt;&quot;x&quot;&amp;")});
it("svg never contains raw script",()=>{const ir=structuredClone(TEMPLATES[0].ir);ir.nodes[0].label="<script>alert(1)</script>";expect(toSVG(ir).svg.includes("<script")).toBe(false)});
it("mermaid and tikz produce output for every template",()=>{for(const t of TEMPLATES){expect(toMermaid(t.ir).startsWith("flowchart TD")).toBe(true);expect(toTikz(t.ir)).toContain("\\end{tikzpicture}")}})});

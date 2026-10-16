import type{IR}from"@/lib/core/ir";
const q=(s:string)=>'"'+s.replace(/["\n\r]/g," ").replace(/[<>]/g,"")+'"';
const W:Record<string,(l:string)=>string>={process:l=>`[${l}]`,decision:l=>`{${l}}`,terminator:l=>`([${l}])`,data:l=>`[/${l}/]`,document:l=>`[${l}]`,database:l=>`[(${l})]`};
export function toMermaid(ir:IR){const id=new Map(ir.nodes.map((n,i)=>[n.id,"n"+(i+1)]));const def=(n:IR["nodes"][number])=>`${id.get(n.id)}${W[n.shape](q(n.label))}`;const L=["flowchart TD"];
ir.groups.forEach((g,i)=>{const m=ir.nodes.filter(n=>n.groupId===g.id);if(!m.length)return;L.push(`  subgraph s${i+1}[${q(g.label)}]`);m.forEach(n=>L.push("    "+def(n)));L.push("  end")});
ir.nodes.filter(n=>!ir.groups.some(g=>g.id===n.groupId)).forEach(n=>L.push("  "+def(n)));
ir.edges.forEach(e=>L.push(`  ${id.get(e.source)} ${e.dashed?"-.->":"-->"}${e.label?`|${q(e.label)}|`:""} ${id.get(e.target)}`));return L.join("\n")}

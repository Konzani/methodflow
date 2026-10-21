import"server-only";
import{IRSchema,type IR,type Method}from"./core/ir";
import{sanitizeIR,validateGraph}from"./core/validate";
import{fixTopology}from"./core/postprocess";
import{layout}from"./core/layout";
import{SYSTEM,REFINE_SYSTEM,userMsg,repairMsg}from"./core/prompt";
import{fallbackFor}from"./templates";

type M={role:"system"|"user"|"assistant";content:string};
type P={name:string;url:string;key:string;model:string};

const providers = (isPro: boolean): P[] => [
  { 
    name: "deepseek", 
    url: "https://api.deepseek.com/chat/completions", 
    key: process.env.DEEPSEEK_API_KEY || "", 
    model: isPro ? (process.env.DEEPSEEK_REASONER_MODEL || "deepseek-reasoner") : (process.env.DEEPSEEK_MODEL || "deepseek-chat") 
  },
  { 
    name: "openai", 
    url: "https://api.openai.com/v1/chat/completions", 
    key: process.env.OPENAI_API_KEY || "", 
    model: process.env.OPENAI_MODEL || "" 
  }
].filter(p => p.key && p.model);

const brk=new Map<string,{f:number;until:number}>();
const tripped=(n:string)=>(brk.get(n)?.until??0)>Date.now();
const fail=(n:string)=>{const b=brk.get(n)??{f:0,until:0};b.f++;if(b.f>=5){b.until=Date.now()+3e5;b.f=0}brk.set(n,b)};
const okp=(n:string)=>brk.delete(n);

async function call(p:P,msgs:M[]){const c=new AbortController();const t=setTimeout(()=>c.abort(),4e4);try{const r=await fetch(p.url,{method:"POST",signal:c.signal,headers:{"Content-Type":"application/json",Authorization:"Bearer "+p.key},body:JSON.stringify({model:p.model,messages:msgs,temperature:.2,top_p:.9,max_tokens:2500,response_format:{type:"json_object"}})});if(!r.ok)throw new Error(p.name+" "+r.status);const j=await r.json();return{text:String(j.choices?.[0]?.message?.content??""),tin:Number(j.usage?.prompt_tokens??0),tout:Number(j.usage?.completion_tokens??0)}}finally{clearTimeout(t)}}

const parse=(t:string):{ir?:IR;issues:string[]}=>{let j:unknown;try{j=JSON.parse(t.replace(/^```(?:json)?|```$/gm,"").trim())}catch{return{issues:["Output was not valid JSON."]}}const r=IRSchema.safeParse(j);if(!r.success)return{issues:r.error.issues.slice(0,6).map(i=>i.path.join(".")+": "+i.message)};const ir=sanitizeIR(r.data);const issues=validateGraph(ir,true);return issues.length?{ir,issues}:{ir,issues:[]}};

export type Gen={ir:IR;source:"ai"|"template";warnings:string[];cost:number;provider?:string};

export async function generate(a:{method:Method;text:string;extra:string;warnings:string[];isPro?:boolean}):Promise<Gen>{
const pin=Number(process.env.PRICE_IN_PER_M||0),pout=Number(process.env.PRICE_OUT_PER_M||0);let cost=0;const w=[...a.warnings];
const ps=providers(a.isPro || false).filter(p=>!tripped(p.name));
if(!ps.length)return{ir:fallbackFor(a.method),source:"template",warnings:[...w,"AI is unavailable. Showing the closest template."],cost};
for(const p of ps){const msgs:M[]=[{role:"system",content:SYSTEM},{role:"user",content:userMsg(a.method,a.text,a.extra)}];
try{for(let i=0;i<2;i++){const r=await call(p,msgs);cost+=(r.tin*pin+r.tout*pout)/1e6;const o=parse(r.text);if(o.ir&&!o.issues.length){okp(p.name);const fixed=fixTopology(o.ir);return{ir:layout(fixed),source:"ai",warnings:w,cost,provider:p.name}}msgs.push({role:"assistant",content:r.text},{role:"user",content:repairMsg(o.issues)})}}catch{fail(p.name)}}
return{ir:fallbackFor(a.method),source:"template",warnings:[...w,"The generator could not produce a valid diagram. Showing the closest template."],cost}}

export async function refine(a:{ir:IR;instruction:string;isPro?:boolean}):Promise<Gen>{
const pin=Number(process.env.PRICE_IN_PER_M||0),pout=Number(process.env.PRICE_OUT_PER_M||0);let cost=0;const w:string[]=[];
const ps=providers(a.isPro || false).filter(p=>!tripped(p.name));
if(!ps.length)return{ir:a.ir,source:"template",warnings:["AI is unavailable."],cost};
for(const p of ps){
  const currentJson = JSON.stringify(a.ir);
  const msgs:M[]=[
    {role:"system",content:REFINE_SYSTEM},
    {role:"user",content:`Current JSON:\n${currentJson}\n\n<instruction>\n${a.instruction}\n</instruction>`}
  ];
  try{
    for(let i=0;i<2;i++){
      const r=await call(p,msgs);cost+=(r.tin*pin+r.tout*pout)/1e6;
      const o=parse(r.text);
      if(o.ir&&!o.issues.length){okp(p.name);const fixed=fixTopology(o.ir);return{ir:layout(fixed),source:"ai",warnings:w,cost,provider:p.name}}
      msgs.push({role:"assistant",content:r.text},{role:"user",content:repairMsg(o.issues)})
    }
  }catch{fail(p.name)}
}
return{ir:a.ir,source:"template",warnings:["The AI could not complete the refinement. Your diagram is unchanged."],cost}}
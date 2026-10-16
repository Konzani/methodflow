import type{Metadata}from"next";import Link from"next/link";import{notFound}from"next/navigation";
import{Header,Footer}from"@/components/Chrome";import{db}from"@/lib/supabase";import{IRSchema}from"@/lib/core/ir";import{sanitizeIR}from"@/lib/core/validate";import{toSVG}from"@/lib/export/svg";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Shared flowchart",robots:{index:false,follow:false}};
export default async function Shared({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!/^[A-Za-z0-9_-]{12}$/.test(slug))return notFound();const c=db();if(!c)return notFound();
const{data}=await c.from("shares").select("ir").eq("slug",slug).gt("expires_at",new Date().toISOString()).maybeSingle();if(!data)return notFound();
const p=IRSchema.safeParse(data.ir);if(!p.success)return notFound();const ir=sanitizeIR(p.data);const{svg}=toSVG(ir);
return<><Header/><main className="wrap page"><h1>{ir.meta.title}</h1><p>Read-only view.</p>
<figure className="plate" style={{margin:"24px 0"}}><div role="img" aria-label={ir.meta.title} dangerouslySetInnerHTML={{__html:svg}}/></figure>
<Link className="btn ghost" href="/templates">Make your own</Link></main><Footer/></>}

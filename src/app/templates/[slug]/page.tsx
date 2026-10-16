import type{Metadata}from"next";import Link from"next/link";import{notFound}from"next/navigation";
import{Header,Footer}from"@/components/Chrome";import{TEMPLATES,getTemplate}from"@/lib/templates";
import{toSVG}from"@/lib/export/svg";import{toMermaid}from"@/lib/export/mermaid";
type P={params:Promise<{slug:string}>};
export const dynamicParams=false;
export const generateStaticParams=()=>TEMPLATES.map(t=>({slug:t.slug}));
export async function generateMetadata({params}:P):Promise<Metadata>{const t=getTemplate((await params).slug);if(!t)return{};return{title:t.title,description:`${t.summary} ${t.when}`.slice(0,158),alternates:{canonical:`/templates/${t.slug}`}}}
export default async function Page({params}:P){const t=getTemplate((await params).slug);if(!t)return notFound();const{svg}=toSVG(t.ir);
return<><Header/><main className="wrap page"><div className="crumb"><Link href="/templates">Templates</Link></div>
<h1>{t.title}</h1><p>{t.summary}</p><p>{t.when}</p>
<p style={{margin:"24px 0"}}><Link className="btn" href={`/app?t=${t.slug}`}>Open this template in the editor</Link></p>
<figure className="plate" style={{margin:"0 0 32px"}}><div role="img" aria-label={t.title} dangerouslySetInnerHTML={{__html:svg}}/><figcaption>Figure 1. {t.title}.</figcaption></figure>
<h2 style={{fontSize:22,marginBottom:12}}>Mermaid code</h2><p>Paste into any Mermaid renderer, including GitHub and Notion.</p><pre className="code">{toMermaid(t.ir)}</pre></main><Footer/></>}

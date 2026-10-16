import type{Metadata}from"next";import Link from"next/link";
import{Header,Footer}from"@/components/Chrome";import{TEMPLATES}from"@/lib/templates";
export const metadata:Metadata={title:"Methodology flowchart templates",description:"Templates for quantitative, qualitative and mixed methods research, plus PRISMA 2020, CONSORT and design science diagrams. Open any template and edit it.",alternates:{canonical:"/templates"}};
export default function T(){return<><Header/><main className="wrap page"><h1>Methodology flowchart templates</h1><p>Each template follows the conventional stages of its design. Open one in the editor and replace the labels with your own.</p>
<ul className="tlist" style={{marginTop:32}}>{TEMPLATES.map(x=><li key={x.slug}><Link href={`/templates/${x.slug}`}>{x.title}<span>{x.summary}</span></Link></li>)}</ul></main><Footer/></>}

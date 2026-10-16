import Link from"next/link";
import{Header,Footer}from"@/components/Chrome";
import{TEMPLATES}from"@/lib/templates";
import{toSVG}from"@/lib/export/svg";
import{SITE}from"@/lib/site";
const FAQ=[
["What is a methodology flowchart?","A diagram that shows the stages of your research in order: from problem definition through sampling and data collection to analysis and reporting. Supervisors and examiners use it to check that your design is coherent."],
["Can I paste the result into Word or LaTeX?","Yes. Word export places the figure with an automatically numbered caption. LaTeX users can copy TikZ code. PNG, SVG and PDF are also available."],
["How accurate is the generated diagram?","It is a draft. The generator follows the standard stages of your chosen design and the details you provide, but it can be wrong. Check every step against your own method before submitting."],
["Do I need an account?","No. Your work is saved in your browser. Export a JSON file to back it up or move it to another device."],
["Is my methodology text stored?","Text you submit for generation is sent to an AI provider to produce the diagram and is not kept in a database by this site. Diagrams you share by link are stored for 90 days."],
];
const ld={"@context":"https://schema.org","@graph":[
{"@type":"WebApplication",name:SITE.name,url:SITE.url,applicationCategory:"EducationalApplication",operatingSystem:"Any",description:SITE.desc,publisher:{"@type":"Organization",name:SITE.parent,url:SITE.parentUrl}},
{"@type":"FAQPage",mainEntity:FAQ.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))}]};
export default function Home(){const t=TEMPLATES[0];const{svg}=toSVG(t.ir);
return<><Header/><main>
<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(ld).replace(/</g,"\\u003c")}}/>
<div className="wrap"><section className="hero">
<div><h1>Methodology flowcharts, drawn to thesis standard.</h1>
<p>Describe your research design or start from a recognised template. Edit the diagram, then export it to Word, PDF, SVG or LaTeX with a numbered caption.</p>
<div className="acts"><Link className="btn" href="/app">Open the editor</Link><Link className="btn ghost" href="/templates">Browse templates</Link></div></div>
<figure className="plate" style={{margin:0}}><div role="img" aria-label={t.title} dangerouslySetInnerHTML={{__html:svg}}/><figcaption>Figure 1. {t.title}, as exported by MethodFlow.</figcaption></figure>
</section>
<section className="sec"><h2>What you get</h2><div className="cols">
<div><h3>Generate from your method</h3><p>Paste your methodology paragraph. MethodFlow returns an editable draft with phases, decisions and labelled branches.</p></div>
<div><h3>Start from a standard</h3><p>PRISMA 2020, CONSORT, quantitative, qualitative, mixed methods and design science templates with the conventional stages in place.</p></div>
<div><h3>Export for your thesis</h3><p>Word with an auto-numbered caption, PDF, PNG, SVG, Mermaid and TikZ. Black and white or light tints for print.</p></div></div></section>
<section className="sec"><h2>How it works</h2><ol className="steps">
<li><strong>Describe or choose.</strong> Pick a research design and paste your method, or open a template.</li>
<li><strong>Edit.</strong> Rename steps, change shapes, add decisions, group steps into phases. Undo and redo are always available.</li>
<li><strong>Export.</strong> Download the figure in the format your thesis template needs.</li></ol></section>
<section className="sec"><h2>Templates</h2><ul className="tlist">{TEMPLATES.map(x=><li key={x.slug}><Link href={`/templates/${x.slug}`}>{x.title}<span>{x.summary}</span></Link></li>)}</ul></section>
<section className="sec"><h2>Your work stays with you</h2><p>Drafts are saved in your browser, not on a server. Nothing is uploaded until you generate a diagram or create a share link.</p></section>
<section className="sec faq"><h2>Questions</h2>{FAQ.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
</div></main><Footer/></>}

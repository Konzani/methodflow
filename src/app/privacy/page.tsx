import type{Metadata}from"next";import{Header,Footer}from"@/components/Chrome";import{SITE}from"@/lib/site";
export const metadata:Metadata={title:"Privacy",alternates:{canonical:"/privacy"}};
// INPUT NEEDED: have this reviewed against the laws that apply to you (for example Kenya's Data Protection Act, GDPR) before launch.
export default function Privacy(){return<><Header/><main className="wrap page"><h1>Privacy</h1>
<p>{SITE.name} has no accounts. Your diagram is saved in your browser's local storage and is not sent to us unless you use one of the two features below.</p>
<h2 style={{fontSize:22,margin:"28px 0 8px"}}>Generating a diagram</h2><p>The text and details you submit are sent to a third-party AI provider to produce the diagram. We do not store that text. We log technical data such as request time and size to prevent abuse, and we use your IP address and a random cookie to apply usage limits.</p>
<h2 style={{fontSize:22,margin:"28px 0 8px"}}>Sharing a diagram</h2><p>A read-only link stores the diagram on our server for 90 days, then it is deleted. Anyone with the link can view it.</p>
<h2 style={{fontSize:22,margin:"28px 0 8px"}}>Contact</h2><p>Questions or deletion requests: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p></main><Footer/></>}

import type{MetadataRoute}from"next";
import{SITE}from"@/lib/site";import{TEMPLATES}from"@/lib/templates";
export default function sitemap():MetadataRoute.Sitemap{const now=new Date();return[{url:SITE.url,lastModified:now,priority:1},{url:SITE.url+"/templates",lastModified:now,priority:.8},...TEMPLATES.map(t=>({url:`${SITE.url}/templates/${t.slug}`,lastModified:now,priority:.9})),{url:SITE.url+"/privacy",lastModified:now,priority:.2}]}

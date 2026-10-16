import{NextRequest}from"next/server";
import{nanoid}from"nanoid";
import{IRSchema}from"@/lib/core/ir";
import{sanitizeIR}from"@/lib/core/validate";
import{db}from"@/lib/supabase";
import{ipOf,limit}from"@/lib/ratelimit";
import{fail,ok}from"@/lib/http";
export const runtime="nodejs";
export async function POST(req:NextRequest){try{
const raw=await req.text();if(raw.length>200000)return fail("TOO_LARGE",413);
const body=JSON.parse(raw);const p=IRSchema.safeParse(body?.ir);if(!p.success)return fail("BAD_REQUEST",400);
const c=db();if(!c)return fail("SHARE_UNAVAILABLE",503);
if(!await limit("share",ipOf(req.headers)))return fail("RATE_LIMITED",429);
const slug=nanoid(12);const{error}=await c.from("shares").insert({slug,ir:sanitizeIR(p.data)});if(error)return fail("SERVER",500);
return ok({slug})}catch(e){if(e instanceof SyntaxError)return fail("BAD_REQUEST",400);return fail("SERVER",500)}}

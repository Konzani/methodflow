import{db}from"@/lib/supabase";
import{legacyModelEnv}from"@/lib/models";
export const dynamic="force-dynamic";
export async function GET(){const ai=!!process.env.DEEPSEEK_API_KEY||!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL);
return Response.json({ok:true,engine:"3",build:(process.env.VERCEL_GIT_COMMIT_SHA||"dev").slice(0,7),checks:{ai:ai?"configured":"missing",share:db()?"configured":"missing",limits:process.env.UPSTASH_REDIS_REST_URL?"redis":"memory",legacyModelEnv:legacyModelEnv()}},{headers:{"Cache-Control":"no-store"}})}

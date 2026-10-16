import{db}from"@/lib/supabase";
export const dynamic="force-dynamic";
export async function GET(){const ai=!!(process.env.DEEPSEEK_API_KEY&&process.env.DEEPSEEK_MODEL)||!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL);
return Response.json({ok:true,checks:{ai:ai?"configured":"missing",share:db()?"configured":"missing",limits:process.env.UPSTASH_REDIS_REST_URL?"redis":"memory"}},{headers:{"Cache-Control":"no-store"}})}

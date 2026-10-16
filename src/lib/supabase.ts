import"server-only";
import{createClient}from"@supabase/supabase-js";
// INPUT NEEDED: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see .env.example)
export const db=()=>{const u=process.env.SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;return u&&k?createClient(u,k,{auth:{persistSession:false}}):null};

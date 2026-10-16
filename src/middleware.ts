import{NextResponse,type NextRequest}from"next/server";
export function middleware(req:NextRequest){const res=NextResponse.next();if(!req.cookies.get("mf_id"))res.cookies.set("mf_id",crypto.randomUUID(),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*365,path:"/"});return res}
export const config={matcher:["/app","/api/generate"]};

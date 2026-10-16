import"server-only";
import{Ratelimit}from"@upstash/ratelimit";
import{Redis}from"@upstash/redis";
type W=`${number} ${"s"|"m"|"h"|"d"}`;
const R=process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN?Redis.fromEnv():null;
const mem=new Map<string,number[]>();
const MS={s:1e3,m:6e4,h:36e5,d:864e5};
const hitMem=(k:string,n:number,w:W)=>{const[a,u]=w.split(" ");const ms=Number(a)*MS[u as"s"];const t=Date.now();const l=(mem.get(k)??[]).filter(x=>t-x<ms);if(l.length>=n){mem.set(k,l);return false}l.push(t);mem.set(k,l);return true};
const cache=new Map<string,Ratelimit>();
async function hit(name:string,id:string,n:number,w:W){if(R){try{let r=cache.get(name);if(!r){r=new Ratelimit({redis:R,limiter:Ratelimit.slidingWindow(n,w),prefix:"mf:"+name});cache.set(name,r)}return(await r.limit(id)).success}catch{}}return hitMem(name+":"+id,n,w)}
// INPUT NEEDED: tune these limits to your expected traffic
const LIM={gen:[["ip",10,"1 h"],["ck",5,"1 d"],["all",1000,"1 h"]],share:[["ip",10,"1 h"],["all",500,"1 h"]]} as const;
export async function limit(kind:keyof typeof LIM,ip:string,ck?:string){for(const[s,n,w]of LIM[kind]){const id=s==="ip"?ip:s==="ck"?ck:"g";if(!id)continue;if(!await hit(kind+s,id,n,w as W))return false}return true}
export const ipOf=(h:Headers)=>(h.get("x-real-ip")||h.get("x-forwarded-for")?.split(",")[0]||"unknown").trim();
const day=()=>new Date().toISOString().slice(0,10);
const CEIL=()=>Number(process.env.DAILY_BUDGET_USD||5);
let memSpend={d:"",v:0};
export async function budgetOk(){try{if(R)return Number(await R.get("mf:spend:"+day())??0)<CEIL()}catch{}return memSpend.d!==day()||memSpend.v<CEIL()}
export async function spend(usd:number){if(!(usd>0))return;try{if(R){const k="mf:spend:"+day();await R.incrbyfloat(k,usd);await R.expire(k,172800);return}}catch{}if(memSpend.d!==day())memSpend={d:day(),v:0};memSpend.v+=usd}

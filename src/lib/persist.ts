import{IRSchema,type IR}from"@/lib/core/ir";
import{sanitizeIR}from"@/lib/core/validate";
const K="mf:draft:v1";
export function saveDraft(ir:IR){try{localStorage.setItem(K,JSON.stringify({t:Date.now(),ir}));return true}catch{return false}}
export function loadDraft():IR|null{try{const r=localStorage.getItem(K);if(!r)return null;const p=IRSchema.safeParse(JSON.parse(r).ir);return p.success?sanitizeIR(p.data):null}catch{return null}}
export function clearDraft(){try{localStorage.removeItem(K)}catch{}}
export function parseIR(text:string):IR|null{try{const p=IRSchema.safeParse(JSON.parse(text));return p.success?sanitizeIR(p.data):null}catch{return null}}

# MethodFlow

Methodology flowchart maker for theses and research papers. Next.js 15 (App Router), TypeScript, React Flow, Zod.
Intended home: **https://methodflow.geodesia.online**

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in the INPUT NEEDED values below
npm run dev                  # http://localhost:3000
npm test                     # vitest: schema, validation, exporters, escaping
```
The editor, templates and all exports work with **no keys at all**. Keys switch on AI generation, sharing and stronger rate limits.

## INPUT NEEDED (search the repo for `INPUT NEEDED` to find each spot)
| # | Where | What you provide |
|---|---|---|
| 1 | `.env.local` / Vercel env | `DEEPSEEK_API_KEY` and `DEEPSEEK_MODEL` (exact model id from DeepSeek's docs) |
| 2 | `.env.local` | `PRICE_IN_PER_M`, `PRICE_OUT_PER_M`, `DAILY_BUDGET_USD` (cost ceiling) |
| 3 | `.env.local` | Upstash Redis URL and token (rate limits and spend counter survive restarts) |
| 4 | `.env.local` + `supabase/migrations/0001_shares.sql` | Supabase URL and service-role key; run the SQL once |
| 5 | `.env.local` | `NEXT_PUBLIC_GSC_TOKEN` for Google Search Console |
| 6 | `src/lib/site.ts` | Product name, contact email, parent site |
| 7 | `src/lib/ratelimit.ts` | Tune the limits to your traffic |
| 8 | `src/app/privacy/page.tsx` | Legal review of the privacy text |
| 9 | `src/lib/templates.ts` | Have a supervisor or methodologist check each template against current PRISMA/CONSORT guidance |
| 10 | `public/og.png` | Replace with your own branded 1200x630 image if you want |

## Deploy (Vercel)
1. Push to GitHub, import the repo in Vercel (framework: Next.js).
2. Add the env vars above.
3. Vercel → Domains → add `flowchart.geodesia.online`. At your DNS host add the CNAME record Vercel shows (usually `flowchart` → `cname.vercel-dns.com`).
4. Supabase → SQL editor → run `supabase/migrations/0001_shares.sql`.
5. Search Console → add the URL-prefix property, submit `/sitemap.xml`.
6. Visit `/api/health` to confirm what is configured.

## Hardening included
- Strict CSP and security headers (`next.config.mjs`); no source maps; `console.*` stripped in production.
- LLM output: JSON mode, Zod parse, graph rules, one repair retry, provider fallback with a circuit breaker, template fallback. The model never supplies coordinates.
- Input: 20 KB body cap, 8,000-character text cap, control characters and injection phrases removed, user text fenced as data.
- Limits per IP, cookie and globally, plus a daily spend ceiling. Redis outage degrades to in-memory limits.
- Work never lost: autosave to the browser every 800 ms and on tab hide, 50-step undo, AI results are undoable, JSON import/export.
- Share links: random 12-char slugs, 90-day expiry, RLS on with no policies (server-only access), `noindex`.
- All SVG text is escaped; LaTeX special characters are escaped.

## Known limits (v1)
- No accounts, cloud sync or real-time collaboration. Drafts live in one browser; export JSON to move them.
- In-memory limits are per serverless instance; use Redis for real enforcement.
- Not yet verified by a full build in the authoring environment (no network): run `npm install && npm run typecheck && npm test && npm run build` first and fix anything the compiler reports.
- Compile the TikZ output once in your own LaTeX setup, and open the DOCX in Word, before relying on them.
- Stripe/billing is not included.

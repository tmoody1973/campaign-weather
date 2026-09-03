# Campaign Weather

**AI-assisted civic evidence infrastructure for live election coverage.**

Campaign Weather turns structured, live public-web records into an inspectable civic-evidence workflow. It opens on a browse-only **Voter Radar** for the 2026 Wisconsin governor race, then moves into **Press Desk**, where every visible signal has provenance, a capture time, a public source link, and a stated limitation.

Built for the SerpApi Best AI Use Case prize at the API Cloud AI Hackathon.

## Why live search data matters

This is not a static political dashboard or a chatbot with web search. SerpApi provides the live public records that make the product useful:

- Google Ads Transparency Center: verified advertiser/creative records and available public spend/view ranges.
- Google News: race-specific reporting context with outlet, date, query, and source URL.
- Google Trends: shared-query relative-interest context, explicitly scoped to its geography and time range.
- Account API: free quota checks before refreshes, keeping a protected search reserve.

Convex stores raw capture references and normalized evidence. Deterministic comparison rules detect new creatives, verified advertisers, material observed-activity changes, and qualifying issue-context clusters. `gpt-5-mini` may write a short neutral brief only from those stored records; it must cite selected evidence and refuse political advice, predictions, rankings, or unsupported claims.

## Product experience

1. **Voter Radar** — separate Ads, News, and Search layers; no composite score or voter-inference claims.
2. **Ad Passport** — a source-linked public creative record with advertiser attribution, available ranges, retrieval provenance, and limitations.
3. **Press Desk** — evidence ledger, transparent reportability rules, provenance detail, and exportable source bundle.

The initial vertical slice is Wisconsin Governor 2026: Tom Tiffany and David Crowley.

## Stack

- Next.js + TypeScript
- Convex (separate Campaign Weather deployment; no authentication in the MVP)
- SerpApi
- OpenAI `gpt-5-mini`, constrained server-side to stored evidence

## Run locally

```bash
npm install
cp .env.example .env.local
npx convex dev
npm run dev
```

Add `SERPAPI_API_KEY` and `OPENAI_API_KEY` only to Convex server environment variables. Never expose either key to the browser or commit it.

## Guardrails

- No user accounts, voter profiles, targeting, polling, predictions, endorsements, or persuasion.
- Ad ranges are never presented as exact totals, unique people, persuasion, or electoral support.
- A missing provider result is labeled `limited` or `updating`, never treated as zero activity.
- AI answers use only stored evidence records and explain what cannot be concluded.

## Status

The standalone Convex project and Wisconsin race foundation are configured. Live SerpApi capture, snapshot comparison, Press Desk filters/export, and constrained Evidence Investigator wiring are the remaining implementation milestones.

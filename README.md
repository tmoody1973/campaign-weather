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
2. **Living Brief** — a source-bound, plain-English reading of the stored snapshot. It states what changed, what to check next, and what cannot be concluded.
3. **Ad Passport** — a source-linked public creative record with advertiser attribution, available ranges, retrieval provenance, and limitations. Public creative copy/media is requested only when a visitor clicks Inspect.
4. **Press Desk** — evidence ledger, transparent reportability rules, provenance detail, and exportable source bundle.

The initial vertical slice is Wisconsin Governor 2026: Tom Tiffany and David Crowley. The live-demo selector also includes Ohio, Michigan, and Texas governor races plus Michigan, Maine, Illinois, and Minnesota U.S. Senate races; each is enabled only with two verified advertiser IDs.

The repository also includes a versioned national 2026 research manifest in [`data/campaign-weather-race-manifest-2026.json`](data/campaign-weather-race-manifest-2026.json), with its [source register](docs/research/campaign-weather-race-manifest-2026-sources.md). It contains 82 research-input races and only marks resolved advertiser IDs as eligible for capture.

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

## Live refresh contract

`ingestion:refreshRace` is the standalone live-capture pipeline. The Voter Radar exposes eight curated, manifest-backed demo races with two verified advertiser IDs each. Before it captures, the pipeline checks SerpApi's free Account API, records the remaining-search snapshot in Convex, and refuses a refresh that would reduce the account below a 40-search reserve. A successful pass makes at most four charged requests: one Google Ads Transparency Center query for each verified advertiser, one Google News request, and one Google Trends comparison. It stores each raw provider response privately in Convex storage, then writes normalized evidence records with their public source links.

The pipeline is intentionally partial-source tolerant: an Ads, News, or Trends failure is recorded as a failed capture without turning the other sources into false zeros. The first successful capture is always a baseline. Only later comparable snapshots can retain and label new creative IDs, new verified advertisers, a two-times aggregate maximum-view-range increase, or a qualified context flag. None of these signals makes a claim about unique reach, voter opinion, or causation.

For every candidate, the UI keeps two adjacent but distinct readings: the **Candidate Ad Ledger** is a source-linked advertiser-profile snapshot whose scope and delay caveat stay visible; the **Creative Fieldbook** contains individual creative ranges. Creative-level spend or shown ranges are never added up to make a false campaign total.

The on-demand `creativeDetails:fetchPublicCreativeDetails` action uses one additional SerpApi Google Ads Transparency Center Ad Details request only after an Inspect click. It stores the raw response and, when the provider supplies them, displays public headline, snippet, call-to-action, destination, thumbnail, or video fields alongside—not in place of—the original source record.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Set `NEXT_PUBLIC_CONVEX_URL` in Vercel to the Convex deployment URL (safe to expose to the browser).
3. Keep `SERPAPI_API_KEY` and `OPENAI_API_KEY` in the Convex deployment environment only—never in Vercel client variables.
4. Deploy. Vercel hosts the Next.js UI; Convex serves the live queries and server-side actions.

## Guardrails

- No user accounts, voter profiles, targeting, polling, predictions, endorsements, or persuasion.
- Ad ranges are never presented as exact totals, unique people, persuasion, or electoral support.
- A missing provider result is labeled `limited` or `updating`, never treated as zero activity.
- AI answers use only stored evidence records and explain what cannot be concluded.

## Status

The standalone Field Station UI, Wisconsin live capture, public advertiser profiles, all-candidate evidence ledger, quota guard, raw-capture storage, on-demand creative details, constrained living brief, and Press Desk are implemented. For a working AI brief, configure `OPENAI_API_KEY` (exact name) in the same Convex deployment that serves the app.

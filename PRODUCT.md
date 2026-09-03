# Campaign Weather

Campaign Weather is anonymous, browse-only **AI-assisted civic evidence infrastructure** for live 2026 election coverage. It starts with the Wisconsin governor race (Tom Tiffany / David Crowley), makes public campaign activity inspectable, and never predicts, persuades, profiles voters, or infers support.

## Product contract

- **Voter Radar** is the first screen: separate Ads, News, and Search layers; source, capture time, status, and limitations always remain visible.
- **Ad Passport** is the proof moment: verified advertiser/candidate mapping, creative metadata, public evidence URL, published spend/view ranges, retrieval provenance, and limits.
- **Candidate Ad Ledger** sits above the Creative Fieldbook: a source-bound advertiser-profile snapshot (scope, reported advertiser total when directly available, Google-reported creative count, geography/format details when directly available, capture time, and delay caveat) beside the separate Field Station observation window. It never fabricates a campaign total by adding creative-level ranges.
- **Press Desk** is the second click: filterable evidence timeline, snapshot differences, provenance detail, evidence-bundle export, and a direct methodology route.
- **Live data** comes from SerpApi only: Google Ads Transparency Center, Google News, Google Trends, and the free Account API for credit safety.
- **National coverage input** is the versioned 2026 manifest in `data/`: 82 research-input races and only verified Google Ads Transparency advertiser IDs may seed automated captures. Its issue filters are context lenses with retained source rationale, not assertions about voter priorities or campaign messaging.
- **Convex** is the independent system of record: it stores raw captures, normalized records, snapshots, changes, reportability assessments, and AI briefs.
- **AI Evidence Investigator** uses `gpt-5-mini` only after deterministic change detection and only with stored records. It produces source-cited `What changed`, `What evidence supports this`, and `What we cannot conclude`; it refuses political advice, comparisons, predictions, and unsupported questions.

## UX contract

The approved visual world is **Great Lakes Field Station**: a deep-water civic instrument board, bathymetric radar field, cream logbook, cyan source readings, restrained orange limited-context marks, and a light Press Desk ledger. The experience must feel trustworthy and inspectable rather than partisan or predictive.

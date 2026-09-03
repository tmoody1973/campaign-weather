# Campaign Weather research inputs

`campaign-weather-race-manifest-2026.json` is the supplied national 2026 research manifest, version 1.0 and dated 2026-09-03. It is a versioned input to Campaign Weather, not a claim that every candidate has live advertising activity.

- 82 input races: 39 governor, 35 U.S. Senate, and 8 U.S. House.
- 129 candidate campaigns have a resolved Google Ads Transparency advertiser ID; 32 remain explicitly unresolved.
- Each race includes issue-lens definitions and source-bound SerpApi test parameters.
- The companion provenance register is in `docs/research/campaign-weather-race-manifest-2026-sources.md`.

Only `googleAdsTransparencyAdvertisers` entries marked `verified` are eligible for automated ad capture. An unresolved profile stays unavailable in the product; it is never guessed from a candidate name or campaign domain.

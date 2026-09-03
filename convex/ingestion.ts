import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const MINIMUM_SEARCH_RESERVE = 40;

type SerpApiRecord = Record<string, unknown>;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function integer(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }
  return undefined;
}

function timestamp(value: unknown): number | undefined {
  const date = text(value);
  if (!date) return undefined;
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function object(value: unknown): SerpApiRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as SerpApiRecord : {};
}

function objects(value: unknown): SerpApiRecord[] {
  return Array.isArray(value) ? value.map(object) : [];
}

async function getSerpApiJson(apiKey: string, parameters: Record<string, string>): Promise<SerpApiRecord> {
  const query = new URLSearchParams({ ...parameters, api_key: apiKey });
  const response = await fetch(`https://serpapi.com/search.json?${query.toString()}`);
  const body = object(await response.json());
  if (!response.ok || text(body.error)) throw new Error(text(body.error) ?? `SerpApi returned HTTP ${response.status}.`);
  return body;
}

async function storeRawPayload(ctx: { storage: { store: (blob: Blob) => Promise<unknown> } }, payload: unknown) {
  return await ctx.storage.store(new Blob([JSON.stringify(payload)], { type: "application/json" }));
}

function normalizeAds(payload: SerpApiRecord, candidateByAdvertiserId: Map<string, string>) {
  return objects(payload.ad_creatives).flatMap((item) => {
    const advertiserId = text(item.advertiser_id);
    const creativeId = text(item.ad_creative_id);
    const detailsLink = text(item.details_link);
    if (!advertiserId || !creativeId || !detailsLink) return [];
    return [{
      candidateName: candidateByAdvertiserId.get(advertiserId), advertiser: text(item.advertiser) ?? "Advertiser not displayed",
      advertiserId, creativeId, format: text(item.format) ?? "Format not displayed", detailsLink,
      previewImage: text(item.image), targetDomain: text(item.target_domain),
      firstShown: timestamp(item.first_shown), lastShown: timestamp(item.last_shown),
      minimumViews: integer(item.minimum_views_count), maximumViews: integer(item.maximum_views_count),
      minimumSpend: text(item.minimum_budget_spent), maximumSpend: text(item.maximum_budget_spent),
    }];
  });
}

function normalizeNews(payload: SerpApiRecord) {
  return objects(payload.news_results).flatMap((item) => {
    const title = text(item.title);
    const url = text(item.link);
    if (!title || !url) return [];
    return [{ title, url, outlet: text(item.source) ?? "Source not displayed", dateLabel: text(item.date), snippet: text(item.snippet) }];
  });
}

function normalizeTrends(payload: SerpApiRecord) {
  const timeline = objects(object(payload.interest_over_time).timeline_data);
  const latest = timeline.at(-1);
  return objects(latest?.values).flatMap((item) => {
    const term = text(item.query);
    if (!term) return [];
    return [{ term, latestValue: integer(item.extracted_value) ?? integer(item.value), isPartial: latest?.isPartial === true }];
  });
}

export const refreshRace = action({ args: { raceKey: v.string() }, returns: v.any(), handler: async (ctx, args) => {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return { status: "blocked", reason: "SERPAPI_API_KEY is not configured in this standalone Convex deployment." };

  const accountResponse = await fetch(`https://serpapi.com/account.json?${new URLSearchParams({ api_key: apiKey }).toString()}`);
  const account = object(await accountResponse.json());
  if (!accountResponse.ok || text(account.error)) return { status: "blocked", reason: text(account.error) ?? "Could not read SerpApi account status." };
  const totalSearchesLeft = integer(account.total_searches_left) ?? 0;
  await ctx.runMutation(internal.campaignWeather.recordBudget, {
    totalSearchesLeft, monthlyUsage: integer(account.this_month_usage), monthlyLimit: integer(account.searches_per_month), renewalDate: text(account.plan_renewal_date),
  });
  if (totalSearchesLeft < MINIMUM_SEARCH_RESERVE + 4) return {
    status: "blocked", reason: `Refresh would preserve the ${MINIMUM_SEARCH_RESERVE}-search reserve; ${totalSearchesLeft} searches remain.`, totalSearchesLeft,
  };

  const raceId = await ctx.runMutation(internal.campaignWeather.seedDemoRace, { key: args.raceKey });
  const race = await ctx.runQuery(internal.campaignWeather.getDemoRace, { key: args.raceKey });
  if (!race) return { status: "failed", reason: "Race configuration was not found." };
  const candidateByAdvertiserId = new Map<string, string>(race.candidates.map((candidate: { advertiserId: string; name: string }) => [candidate.advertiserId, candidate.name]));
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll("-", "");
  const adsBaseParameters = { engine: "google_ads_transparency_center", political_ads: "true", region: "2840", start_date: thirtyDaysAgo, end_date: today, num: "100" };
  const adsSearches = race.candidates.map((candidate: { advertiserId: string; name: string }) => ({
    candidate,
    parameters: { ...adsBaseParameters, advertiser_id: candidate.advertiserId },
  }));
  const candidateNames = race.candidates.map((candidate: { name: string }) => candidate.name);
  const raceTerms = `${race.state} ${race.office} 2026 ${candidateNames.join(" ")}`;
  const newsParameters = { engine: "google", tbm: "nws", q: raceTerms, gl: "us", hl: "en" };
  const trendsParameters = { engine: "google_trends", q: candidateNames.join(","), geo: `US-${race.state === "Wisconsin" ? "WI" : race.state === "Ohio" ? "OH" : race.state === "Michigan" ? "MI" : "TX"}`, date: "today 3-m", data_type: "TIMESERIES", hl: "en" };
  const [adsCaptureId, newsCaptureId, trendsCaptureId] = await Promise.all([
    ctx.runMutation(internal.campaignWeather.startCapture, { raceId, source: "ads", query: `Verified Google political advertisers: ${candidateNames.join(" + ")}`, parameters: { ...adsBaseParameters, advertiser_ids: adsSearches.map(item => item.candidate.advertiserId).join(",") } }),
    ctx.runMutation(internal.campaignWeather.startCapture, { raceId, source: "news", query: raceTerms, parameters: newsParameters }),
    ctx.runMutation(internal.campaignWeather.startCapture, { raceId, source: "trends", query: candidateNames.join(","), parameters: trendsParameters }),
  ]);

  const [adsResults, newsResult, trendsResult] = await Promise.all([
    Promise.allSettled(adsSearches.map(item => getSerpApiJson(apiKey, item.parameters))),
    getSerpApiJson(apiKey, newsParameters).then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason })),
    getSerpApiJson(apiKey, trendsParameters).then(value => ({ status: "fulfilled" as const, value }), reason => ({ status: "rejected" as const, reason })),
  ]);
  const outcomes: Record<string, { status: "succeeded" | "failed"; count?: number; error?: string }> = {};
  let newNewsUrls: string[] = [];
  let hasPriorNewsSnapshot = false;
  const successfulAds = adsResults.flatMap((result, index) => result.status === "fulfilled" ? [{ candidate: adsSearches[index].candidate, payload: result.value }] : []);
  const failedAds = adsResults.flatMap((result, index) => result.status === "rejected" ? [`${adsSearches[index].candidate.name}: ${result.reason instanceof Error ? result.reason.message : "Ads capture failed."}`] : []);
  if (successfulAds.length > 0) {
    const rawStorageId = await storeRawPayload(ctx, { ads: successfulAds.map(item => ({ candidate: item.candidate.name, advertiserId: item.candidate.advertiserId, payload: item.payload })), errors: failedAds });
    const result = await ctx.runMutation(internal.campaignWeather.completeAdsCapture, { captureId: adsCaptureId, rawStorageId: rawStorageId as never, records: successfulAds.flatMap(item => normalizeAds(item.payload, candidateByAdvertiserId)), errorMessage: failedAds.length ? `Partial advertiser capture: ${failedAds.join(" | ")}` : undefined });
    outcomes.ads = { status: "succeeded", count: result.recordCount };
  } else {
    const error = failedAds.join(" | ") || "Ads capture failed.";
    await ctx.runMutation(internal.campaignWeather.failCapture, { captureId: adsCaptureId, errorMessage: error }); outcomes.ads = { status: "failed", error };
  }
  if (newsResult.status === "fulfilled") {
    const rawStorageId = await storeRawPayload(ctx, newsResult.value);
    const result = await ctx.runMutation(internal.campaignWeather.completeNewsCapture, { captureId: newsCaptureId, rawStorageId: rawStorageId as never, records: normalizeNews(newsResult.value) });
    newNewsUrls = result.newNewsUrls; hasPriorNewsSnapshot = result.hasPriorSnapshot; outcomes.news = { status: "succeeded", count: result.recordCount };
  } else {
    const error = newsResult.reason instanceof Error ? newsResult.reason.message : "News capture failed.";
    await ctx.runMutation(internal.campaignWeather.failCapture, { captureId: newsCaptureId, errorMessage: error }); outcomes.news = { status: "failed", error };
  }
  if (trendsResult.status === "fulfilled") {
    const rawStorageId = await storeRawPayload(ctx, trendsResult.value);
    const count = await ctx.runMutation(internal.campaignWeather.completeTrendsCapture, { captureId: trendsCaptureId, rawStorageId: rawStorageId as never, records: normalizeTrends(trendsResult.value) });
    outcomes.trends = { status: "succeeded", count };
    if (hasPriorNewsSnapshot && newNewsUrls.length >= 2) await ctx.runMutation(internal.campaignWeather.detectQualifiedIssueContext, { raceId, newsCaptureId, trendCaptureId: trendsCaptureId, newNewsUrls });
  } else {
    const error = trendsResult.reason instanceof Error ? trendsResult.reason.message : "Trends capture failed.";
    await ctx.runMutation(internal.campaignWeather.failCapture, { captureId: trendsCaptureId, errorMessage: error }); outcomes.trends = { status: "failed", error };
  }
  return { status: "complete", totalSearchesLeft, outcomes };
} });

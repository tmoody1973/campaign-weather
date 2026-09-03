import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const MINIMUM_SEARCH_RESERVE = 40;
type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : typeof value === "string" &&
        Number.isFinite(Number(value.replace(/[^0-9.-]/g, "")))
      ? Math.round(Number(value.replace(/[^0-9.-]/g, "")))
      : undefined;
}

export const fetchPublicCreativeDetails = action({
  args: { creativeId: v.id("adCreatives") },
  returns: v.any(),
  handler: async (ctx, args): Promise<any> => {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey)
      return {
        status: "blocked",
        reason:
          "SERPAPI_API_KEY is not configured in this standalone Convex deployment.",
      };
    const creative: any = await ctx.runQuery(
      internal.campaignWeather.getCreativeForDetails,
      args,
    );
    if (!creative)
      return {
        status: "blocked",
        reason: "The requested public creative record no longer exists.",
      };
    if (creative.detailsFetchedAt) return { status: "complete", cached: true };
    const accountResponse = await fetch(
      `https://serpapi.com/account.json?${new URLSearchParams({ api_key: apiKey }).toString()}`,
    );
    const account = object(await accountResponse.json());
    const searchesLeft = integer(account.total_searches_left) ?? 0;
    if (!accountResponse.ok || text(account.error))
      return {
        status: "blocked",
        reason:
          text(account.error) ?? "Could not check SerpApi account status.",
      };
    if (searchesLeft < MINIMUM_SEARCH_RESERVE + 1)
      return {
        status: "blocked",
        reason: `Creative detail fetch would preserve the ${MINIMUM_SEARCH_RESERVE}-search reserve; ${searchesLeft} searches remain.`,
      };
    const query = new URLSearchParams({
      engine: "google_ads_transparency_center_ad_details",
      advertiser_id: creative.advertiserId,
      creative_id: creative.creativeId,
      region: "2840",
      api_key: apiKey,
    });
    const response = await fetch(
      `https://serpapi.com/search.json?${query.toString()}`,
    );
    const payload = object(await response.json());
    if (!response.ok || text(payload.error))
      return {
        status: "failed",
        reason:
          text(payload.error) ?? `SerpApi returned HTTP ${response.status}.`,
      };
    const details = object(
      payload.ad_creative ??
        (Array.isArray(payload.ad_creatives)
          ? payload.ad_creatives[0]
          : undefined),
    );
    const rawStorageId = await ctx.storage.store(
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
    await ctx.runMutation(internal.campaignWeather.completeCreativeDetails, {
      creativeId: args.creativeId,
      rawStorageId: rawStorageId as never,
      creativeTitle: text(details.title),
      creativeHeadline: text(details.headline),
      creativeLongHeadline: text(details.long_headline),
      creativeSnippet: text(details.snippet),
      callToAction: text(details.call_to_action),
      visibleLink: text(details.visible_link),
      destinationUrl: text(details.link),
      mediaUrl: text(details.thumbnail) ?? text(details.image),
      videoUrl: text(details.raw_video_link) ?? text(details.video_link),
      videoDuration: text(details.video_duration),
    });
    return {
      status: "complete",
      cached: false,
      fields: [
        "title",
        "headline",
        "long_headline",
        "snippet",
        "call_to_action",
        "visible_link",
        "thumbnail",
        "video_link",
      ].filter((field) => details[field] !== undefined),
    };
  },
});

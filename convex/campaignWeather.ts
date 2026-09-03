import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const WISCONSIN = { key: "wi-governor-2026", name: "Wisconsin Governor 2026", office: "Governor", state: "Wisconsin", electionDate: "2026-11-03", candidates: [{ name: "Tom Tiffany", campaignDomain: "tomtiffany.com", advertiserId: "AR15612586122486480897" }, { name: "David Crowley", campaignDomain: "crowleyforwi.com", advertiserId: "AR00233328882948767745" }] };

export const seedWisconsin = internalMutation({ args: {}, returns: v.id("races"), handler: async (ctx) => {
  const current = await ctx.db.query("races").withIndex("by_key", q => q.eq("key", WISCONSIN.key)).unique();
  if (current) return current._id;
  return await ctx.db.insert("races", { ...WISCONSIN, updatedAt: Date.now() });
} });

export const getWisconsinRadar = query({ args: {}, returns: v.any(), handler: async (ctx) => {
  const race = await ctx.db.query("races").withIndex("by_key", q => q.eq("key", WISCONSIN.key)).unique();
  if (!race) return null;
  const captures = await ctx.db.query("captureRuns").withIndex("by_race_source_captured", q => q.eq("raceId", race._id)).collect();
  const latest = (source: "ads" | "news" | "trends") => captures.filter(c => c.source === source && c.status === "succeeded").sort((a,b) => b.capturedAt - a.capturedAt)[0];
  const ads = latest("ads"), news = latest("news"), trends = latest("trends");
  const [creatives, newsItems, trendItems, changes, budget] = await Promise.all([
    ads ? ctx.db.query("adCreatives").withIndex("by_capture", q => q.eq("captureId", ads._id)).collect() : [],
    news ? ctx.db.query("newsItems").withIndex("by_capture", q => q.eq("captureId", news._id)).collect() : [],
    trends ? ctx.db.query("trendObservations").withIndex("by_capture", q => q.eq("captureId", trends._id)).collect() : [],
    ctx.db.query("evidenceChanges").withIndex("by_race_created", q => q.eq("raceId", race._id)).order("desc").take(24),
    ctx.db.query("searchBudgets").withIndex("by_checked").order("desc").first(),
  ]);
  return { race, captures: { ads: ads ?? null, news: news ?? null, trends: trends ?? null }, creatives, newsItems, trendItems, changes, budget };
} });

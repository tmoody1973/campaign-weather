import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const WISCONSIN = { key: "wi-governor-2026", name: "Wisconsin Governor 2026", office: "Governor", state: "Wisconsin", electionDate: "2026-11-03", candidates: [{ name: "Tom Tiffany", campaignDomain: "tomtiffany.com", advertiserId: "AR15612586122486480897" }, { name: "David Crowley", campaignDomain: "crowleyforwi.com", advertiserId: "AR00233328882948767745" }] };

export const seedWisconsin = internalMutation({ args: {}, returns: v.id("races"), handler: async (ctx) => {
  const current = await ctx.db.query("races").withIndex("by_key", q => q.eq("key", WISCONSIN.key)).unique();
  if (current) return current._id;
  return await ctx.db.insert("races", { ...WISCONSIN, updatedAt: Date.now() });
} });

export const getWisconsinRace = internalQuery({ args: {}, returns: v.any(), handler: async (ctx) => {
  return await ctx.db.query("races").withIndex("by_key", q => q.eq("key", WISCONSIN.key)).unique();
} });

const captureSource = v.union(v.literal("ads"), v.literal("news"), v.literal("trends"));

export const startCapture = internalMutation({ args: {
  raceId: v.id("races"), source: captureSource, query: v.string(), parameters: v.record(v.string(), v.string()),
}, returns: v.id("captureRuns"), handler: async (ctx, args) => {
  return await ctx.db.insert("captureRuns", { ...args, status: "updating", capturedAt: Date.now(), resultCount: 0 });
} });

export const recordBudget = internalMutation({ args: {
  totalSearchesLeft: v.number(), monthlyUsage: v.optional(v.number()), monthlyLimit: v.optional(v.number()), renewalDate: v.optional(v.string()),
}, returns: v.id("searchBudgets"), handler: async (ctx, args) => {
  return await ctx.db.insert("searchBudgets", { ...args, checkedAt: Date.now() });
} });

export const failCapture = internalMutation({ args: { captureId: v.id("captureRuns"), errorMessage: v.string() }, returns: v.null(), handler: async (ctx, args) => {
  await ctx.db.patch(args.captureId, { status: "failed", errorMessage: args.errorMessage });
  return null;
} });

const adRecord = v.object({
  candidateName: v.optional(v.string()), advertiser: v.string(), advertiserId: v.string(), creativeId: v.string(), format: v.string(), detailsLink: v.string(),
  firstShown: v.optional(v.number()), lastShown: v.optional(v.number()), minimumViews: v.optional(v.number()), maximumViews: v.optional(v.number()), minimumSpend: v.optional(v.string()), maximumSpend: v.optional(v.string()),
});

export const completeAdsCapture = internalMutation({ args: {
  captureId: v.id("captureRuns"), rawStorageId: v.id("_storage"), records: v.array(adRecord), errorMessage: v.optional(v.string()),
}, returns: v.object({ recordCount: v.number(), newCreativeUrls: v.array(v.string()) }), handler: async (ctx, args) => {
  const capture = await ctx.db.get(args.captureId);
  if (!capture) throw new Error("Capture was not found.");
  const priorCapture = (await ctx.db.query("captureRuns").withIndex("by_race_source_captured", q => q.eq("raceId", capture.raceId)).collect())
    .filter(item => item.source === "ads" && item.status === "succeeded" && item._id !== capture._id)
    .sort((a, b) => b.capturedAt - a.capturedAt)[0];
  const priorRecords = priorCapture
    ? await ctx.db.query("adCreatives").withIndex("by_capture", q => q.eq("captureId", priorCapture._id)).collect()
    : [];
  const priorCreativeIds = new Set(priorRecords.map(item => item.creativeId));
  const priorAdvertiserIds = new Set(priorRecords.map(item => item.advertiserId));
  for (const record of args.records) await ctx.db.insert("adCreatives", { ...record, raceId: capture.raceId, captureId: capture._id });
  await ctx.db.patch(capture._id, { status: "succeeded", rawStorageId: args.rawStorageId, resultCount: args.records.length, errorMessage: args.errorMessage });

  const newRecords = args.records.filter(item => !priorCreativeIds.has(item.creativeId));
  const newCreativeUrls = newRecords.map(item => item.detailsLink);
  if (priorCapture && newRecords.length > 0) {
    const newAdvertiserUrls = newRecords.filter(item => !priorAdvertiserIds.has(item.advertiserId)).map(item => item.detailsLink);
    if (newAdvertiserUrls.length > 0) await ctx.db.insert("evidenceChanges", {
      raceId: capture.raceId, captureId: capture._id, kind: "new_advertiser", reportable: true,
      rule: "A verified advertiser ID not present in the prior successful ads snapshot was observed.", evidenceUrls: newAdvertiserUrls, createdAt: Date.now(),
    });
    await ctx.db.insert("evidenceChanges", {
      raceId: capture.raceId, captureId: capture._id, kind: "new_creative", reportable: newRecords.length >= 2,
      rule: newRecords.length >= 2 ? "Two or more new creative IDs were observed since the prior successful ads snapshot." : "One new creative ID was observed; retained as evidence but below the reportable threshold.",
      evidenceUrls: newCreativeUrls, createdAt: Date.now(),
    });
  }
  const priorMaximumViews = priorRecords.reduce((sum, item) => sum + (item.maximumViews ?? 0), 0);
  const currentMaximumViews = args.records.reduce((sum, item) => sum + (item.maximumViews ?? 0), 0);
  if (priorCapture && priorMaximumViews > 0 && currentMaximumViews >= priorMaximumViews * 2) await ctx.db.insert("evidenceChanges", {
    raceId: capture.raceId, captureId: capture._id, kind: "activity_increase", reportable: true,
    rule: "Aggregate maximum observed views are at least twice the prior successful ads snapshot. This is an observed-range comparison, not a measure of reach or persuasion.",
    evidenceUrls: args.records.map(item => item.detailsLink), createdAt: Date.now(),
  });
  return { recordCount: args.records.length, newCreativeUrls };
} });

const newsRecord = v.object({ title: v.string(), outlet: v.string(), url: v.string(), dateLabel: v.optional(v.string()), snippet: v.optional(v.string()) });

export const completeNewsCapture = internalMutation({ args: {
  captureId: v.id("captureRuns"), rawStorageId: v.id("_storage"), records: v.array(newsRecord),
}, returns: v.object({ recordCount: v.number(), newNewsUrls: v.array(v.string()), hasPriorSnapshot: v.boolean() }), handler: async (ctx, args) => {
  const capture = await ctx.db.get(args.captureId);
  if (!capture) throw new Error("Capture was not found.");
  const priorCapture = (await ctx.db.query("captureRuns").withIndex("by_race_source_captured", q => q.eq("raceId", capture.raceId)).collect())
    .filter(item => item.source === "news" && item.status === "succeeded" && item._id !== capture._id)
    .sort((a, b) => b.capturedAt - a.capturedAt)[0];
  const priorUrls = new Set(priorCapture ? (await ctx.db.query("newsItems").withIndex("by_capture", q => q.eq("captureId", priorCapture._id)).collect()).map(item => item.url) : []);
  for (const record of args.records) await ctx.db.insert("newsItems", { ...record, raceId: capture.raceId, captureId: capture._id });
  await ctx.db.patch(capture._id, { status: "succeeded", rawStorageId: args.rawStorageId, resultCount: args.records.length, errorMessage: undefined });
  return { recordCount: args.records.length, newNewsUrls: args.records.filter(item => !priorUrls.has(item.url)).map(item => item.url), hasPriorSnapshot: Boolean(priorCapture) };
} });

const trendRecord = v.object({ term: v.string(), latestValue: v.optional(v.number()), isPartial: v.boolean() });

export const completeTrendsCapture = internalMutation({ args: {
  captureId: v.id("captureRuns"), rawStorageId: v.id("_storage"), records: v.array(trendRecord),
}, returns: v.number(), handler: async (ctx, args) => {
  const capture = await ctx.db.get(args.captureId);
  if (!capture) throw new Error("Capture was not found.");
  for (const record of args.records) await ctx.db.insert("trendObservations", { ...record, raceId: capture.raceId, captureId: capture._id });
  await ctx.db.patch(capture._id, { status: "succeeded", rawStorageId: args.rawStorageId, resultCount: args.records.length, errorMessage: undefined });
  return args.records.length;
} });

export const detectQualifiedIssueContext = internalMutation({ args: {
  raceId: v.id("races"), newsCaptureId: v.id("captureRuns"), trendCaptureId: v.id("captureRuns"), newNewsUrls: v.array(v.string()),
}, returns: v.boolean(), handler: async (ctx, args) => {
  const trends = await ctx.db.query("trendObservations").withIndex("by_capture", q => q.eq("captureId", args.trendCaptureId)).collect();
  if (args.newNewsUrls.length < 2 || trends.filter(item => item.latestValue !== undefined).length < 2) return false;
  await ctx.db.insert("evidenceChanges", {
    raceId: args.raceId, captureId: args.newsCaptureId, kind: "issue_context", reportable: true,
    rule: "At least two new public race-context records were captured alongside a current two-term Trends comparison. This flags context for review; it does not establish causation, sentiment, or voter opinion.",
    evidenceUrls: args.newNewsUrls, createdAt: Date.now(),
  });
  return true;
} });

export const removeBaselineIssueContext = internalMutation({ args: { captureId: v.id("captureRuns") }, returns: v.number(), handler: async (ctx, args) => {
  const changes = await ctx.db.query("evidenceChanges").filter(q => q.eq(q.field("captureId"), args.captureId)).collect();
  const incorrectBaselineFlags = changes.filter(change => change.kind === "issue_context");
  for (const change of incorrectBaselineFlags) await ctx.db.delete(change._id);
  return incorrectBaselineFlags.length;
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

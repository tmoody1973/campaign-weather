import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const modelId = "gpt-5-mini";

const briefSchema = z.object({
  headline: z
    .string()
    .describe("Neutral, plain-English headline of 8 words or fewer."),
  plainSummary: z
    .string()
    .describe("One neutral plain-English paragraph of 45 words or fewer."),
  whatChanged: z
    .string()
    .describe("One sentence. State baseline when no reportable change exists."),
  watchNext: z
    .string()
    .describe(
      "One sentence about the next evidence check, not political advice.",
    ),
  cannotConclude: z.string().describe("One sentence naming a limitation."),
  evidenceRecordIds: z
    .array(z.string())
    .max(4)
    .describe(
      "Only IDs from the supplied evidence list that directly support the brief.",
    ),
});

function compactEvidence(evidence: any) {
  const creativeEvidence = evidence.creatives.map((item: any) => ({
    id: `ad:${item._id}`,
    kind: "public ad",
    title: `${item.candidateName ?? item.advertiser} ${item.format} creative`,
    sourceUrl: item.detailsLink,
    detail: {
      minimumViews: item.minimumViews,
      maximumViews: item.maximumViews,
      minimumSpend: item.minimumSpend,
      maximumSpend: item.maximumSpend,
      targetDomain: item.targetDomain,
    },
  }));
  const newsEvidence = evidence.newsItems.map((item: any) => ({
    id: `news:${item._id}`,
    kind: "news context",
    title: item.title,
    sourceUrl: item.url,
    detail: {
      outlet: item.outlet,
      date: item.dateLabel,
      snippet: item.snippet,
    },
  }));
  const trendEvidence = evidence.trendItems.map((item: any) => ({
    id: `trend:${item._id}`,
    kind: "search attention",
    title: `${item.term} relative search interest`,
    sourceUrl: "https://trends.google.com/trends/",
    detail: { latestValue: item.latestValue, isPartial: item.isPartial },
  }));
  return [...creativeEvidence, ...newsEvidence, ...trendEvidence];
}

export const refreshLivingBrief = action({
  args: { raceKey: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<any> => {
    if (!process.env.OPENAI_API_KEY)
      return {
        status: "blocked",
        reason:
          "OPENAI_API_KEY is not configured in this standalone Convex deployment.",
      };
    const evidence: any = await ctx.runQuery(
      internal.campaignWeather.getBriefEvidence,
      { key: args.raceKey },
    );
    if (!evidence?.captures?.ads)
      return {
        status: "blocked",
        reason: "Fetch public race records before generating a living brief.",
      };
    const records = compactEvidence(evidence);
    if (records.length === 0)
      return {
        status: "blocked",
        reason: "The latest capture contains no usable public records.",
      };
    const allowed = new Map(records.map((record: any) => [record.id, record]));
    const sourceContext = records
      .map((record: any) => JSON.stringify(record))
      .join("\n");
    const reportableChanges = evidence.changes
      .filter((change: any) => change.reportable)
      .map((change: any) => ({
        kind: change.kind,
        rule: change.rule,
        evidenceUrls: change.evidenceUrls,
      }));
    const result = await generateText({
      model: openai(modelId),
      output: Output.object({ schema: briefSchema }),
      prompt: `You are Campaign Weather's neutral civic evidence editor. Write a living brief for voters about ${evidence.race.name}. Use only the supplied stored evidence. Never recommend a candidate, predict results, imply voter opinion, infer persuasion, add facts, or attribute a claim to a source that does not support it. Ads are public provider records; amount spent and times shown are ranges, not exact totals or unique people. Google Trends measures relative search interest, not support. News is public context, not a fact check.\n\nA change is reportable only if it is in REPORTABLE CHANGES. If the list is empty, say the current capture is a baseline or no reportable change has met a threshold.\n\nREPORTABLE CHANGES:\n${JSON.stringify(reportableChanges)}\n\nSTORED EVIDENCE (cite only IDs from here):\n${sourceContext}`,
    });
    const output = result.output;
    const supportingEvidence = output.evidenceRecordIds
      .filter((id) => allowed.has(id))
      .map((id) => {
        const record = allowed.get(id);
        return {
          recordId: record.id,
          title: record.title,
          sourceUrl: record.sourceUrl,
        };
      });
    const briefId: any = await ctx.runMutation(
      internal.campaignWeather.recordLivingBrief,
      {
        raceId: evidence.race._id,
        captureId: evidence.captures.ads._id,
        question: `What public campaign activity changed in ${evidence.race.name}?`,
        outcome: "answer",
        headline: output.headline,
        plainSummary: output.plainSummary,
        whatChanged: output.whatChanged,
        watchNext: output.watchNext,
        supportingEvidence,
        cannotConclude: output.cannotConclude,
        modelId,
      },
    );
    return {
      status: "complete",
      briefId,
      supportingEvidenceCount: supportingEvidence.length,
    };
  },
});

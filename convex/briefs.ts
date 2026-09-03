import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const modelId = "gpt-5-mini";

const briefSchema = z.object({
  headline: z
    .string()
    .describe("Neutral local-news headline of 9 words or fewer."),
  plainSummary: z
    .string()
    .describe("A useful 35–55 word reader's deck that orients a voter."),
  advertising: z.object({
    body: z
      .string()
      .describe(
        "35–55 words. Describe only what the current public ad capture shows; do not total spending ranges or imply reach or effectiveness.",
      ),
    evidenceRecordIds: z.array(z.string()).min(1).max(3),
  }),
  reporting: z.object({
    body: z
      .string()
      .describe(
        "35–55 words. Attribute news context as reporting and state only what its cited records support.",
      ),
    evidenceRecordIds: z.array(z.string()).min(1).max(3),
  }),
  issueContext: z.object({
    body: z
      .string()
      .describe(
        "25–45 words. Name one issue only when cited public records support it; otherwise say no issue theme is yet clear from this capture.",
      ),
    evidenceRecordIds: z.array(z.string()).min(1).max(3),
  }),
  whatChanged: z
    .string()
    .describe("One sentence. State baseline when no reportable change exists."),
  watchNext: z
    .string()
    .describe(
      "One sentence about the next evidence check, not political advice.",
    ),
  cannotConclude: z.string().describe("One sentence naming a limitation."),
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

function sourceReferences(
  ids: string[],
  allowed: Map<string, any>,
  body: string,
) {
  const namedIds = body.match(/\b(?:ad|news|trend):[a-z0-9]+\b/gi) ?? [];
  const normalizedBody = body.toLowerCase();
  const namedOutletIds = [...allowed.values()]
    .filter(
      (record) =>
        record.kind === "news context" &&
        record.detail.outlet &&
        normalizedBody.includes(record.detail.outlet.toLowerCase()),
    )
    .map((record) => record.id);
  return [...new Set([...ids, ...namedIds, ...namedOutletIds])]
    .filter((id) => allowed.has(id))
    .map((id) => {
      const record = allowed.get(id);
      return {
        recordId: record.id,
        title: record.title,
        sourceUrl: record.sourceUrl,
      };
    });
}

function readerBody(value: string) {
  return value
    .replace(/\s*\((?=[^)]*\b(?:ad|news|trend):)[^)]*\)/gi, "")
    .replace(/\b(?:ad|news|trend):[a-z0-9]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function readerHeadline(value: string, hasActivityIncrease: boolean) {
  if (hasActivityIncrease) return value;
  return value.replace(/\bads? surge\b/gi, "public ads listed");
}

function readerSummary(value: string) {
  return value
    .replace(/\bnumerous high[‑-]visibility\b/gi, "multiple")
    .replace(/\bhigh[‑-]visibility\b/gi, "public")
    .trim();
}

export const refreshLivingBrief = action({
  args: { raceKey: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<any> => {
    // Accept the original project variable during the hackathon; OpenAI's
    // canonical name remains OPENAI_API_KEY for production deployments.
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAPI_API_KEY;
    if (!apiKey)
      return {
        status: "blocked",
        reason:
          "An OpenAI API key is not configured in this standalone Convex deployment.",
      };
    const model = createOpenAI({ apiKey });
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
    const currentCaptureFacts = {
      capturedPublicCreativeRecords: evidence.creatives.reduce(
        (counts: Record<string, number>, item: any) => {
          const name = item.candidateName ?? item.advertiser;
          counts[name] = (counts[name] ?? 0) + 1;
          return counts;
        },
        {},
      ),
      publicNewsRecords: evidence.newsItems.length,
      searchReadings: evidence.trendItems.length,
    };
    const reportableChanges = evidence.changes
      .filter((change: any) => change.reportable)
      .map((change: any) => ({
        kind: change.kind,
        rule: change.rule,
        evidenceUrls: change.evidenceUrls,
      }));
    const hasActivityIncrease = reportableChanges.some(
      (change: any) => change.kind === "activity_increase",
    );
    const result = await generateText({
      model: model(modelId),
      output: Output.object({ schema: briefSchema }),
      prompt: `You are a careful local journalist writing a short reader's brief for voters about ${evidence.race.name}. Your job is to orient readers with public evidence, not to persuade them. Use only the supplied records and capture facts. Never recommend a candidate, predict results, imply voter opinion, infer persuasion, add facts, or make a claim without a supporting ID in that same section.\n\nWrite in plain English. This should feel useful to a busy voter: explain the public advertising picture separately from news coverage and from an issue theme. Do not call a story a poll, debate, or issue unless the cited news record says so. Do not use Trends unless it adds clear context; it measures relative search interest, not support. Ads are public provider records: reported spend/view values are ranges, not exact totals or unique people. Do not add creative spend ranges together. Do not write source IDs, political party labels, or any technical metadata in reader-facing prose.\n\nCITATION CONTRACT: Every section body must discuss only the records named in that section's evidenceRecordIds. advertising.evidenceRecordIds must include ad: IDs; if the body names or compares candidates, include an ad: ID for every named candidate. reporting.evidenceRecordIds must include news: IDs for every outlet, event, or claim named in the reporting body. issueContext.evidenceRecordIds must include the exact ad: or news: IDs that support its wording. Use two or three precise sentences, not a roundup of uncited stories. Do not use a source just because it is from the same race.\n\nA change is reportable only if it is in REPORTABLE CHANGES. If the list is empty, say the current capture is a baseline or no reportable change has met a threshold.\n\nCURRENT CAPTURE FACTS:\n${JSON.stringify(currentCaptureFacts)}\n\nREPORTABLE CHANGES:\n${JSON.stringify(reportableChanges)}\n\nSTORED EVIDENCE (cite only IDs from here):\n${sourceContext}`,
    });
    const output = result.output;
    const sections = [
      {
        label: "Public advertising",
        body: readerBody(output.advertising.body),
        supportingEvidence: sourceReferences(
          output.advertising.evidenceRecordIds,
          allowed,
          output.advertising.body,
        ),
      },
      {
        label: "What reporting says",
        body: readerBody(output.reporting.body),
        supportingEvidence: sourceReferences(
          output.reporting.evidenceRecordIds,
          allowed,
          output.reporting.body,
        ),
      },
      {
        label: "Issue in context",
        body: readerBody(output.issueContext.body),
        supportingEvidence: sourceReferences(
          output.issueContext.evidenceRecordIds,
          allowed,
          output.issueContext.body,
        ),
      },
    ];
    const supportingEvidence = sections
      .flatMap((section) => section.supportingEvidence)
      .filter(
        (source, index, list) =>
          list.findIndex((item) => item.recordId === source.recordId) === index,
      );
    const briefId: any = await ctx.runMutation(
      internal.campaignWeather.recordLivingBrief,
      {
        raceId: evidence.race._id,
        captureId: evidence.captures.ads._id,
        question: `What public campaign activity changed in ${evidence.race.name}?`,
        outcome: "answer",
        headline: readerHeadline(output.headline, hasActivityIncrease),
        plainSummary: readerSummary(output.plainSummary),
        sections,
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

import { v } from "convex/values";
import { action } from "./_generated/server";

const candidates = {
  "Amy Acton": "actonforgovernor.com",
  "Mike Rogers": "rogersforsenate.com",
  "Troy D. Jackson": "jacksonformaine.com",
} as const;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function matchesOfficialDomain(value: string | undefined, domain: string) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return value.includes(domain);
  }
}

// A small, explicit admin helper for resolving only the manifest's missing demo
// portraits. Results are returned for review; no image is adopted automatically.
export const findOfficialPortrait = action({
  args: { candidateName: v.string() },
  returns: v.any(),
  handler: async (_ctx, args): Promise<any> => {
    const domain = candidates[args.candidateName as keyof typeof candidates];
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!domain)
      return {
        status: "blocked",
        reason:
          "This candidate is not in the missing-demo-portrait review list.",
      };
    if (!apiKey)
      return {
        status: "blocked",
        reason: "SERPAPI_API_KEY is not configured.",
      };
    const params = new URLSearchParams({
      engine: "google_images",
      q: `${args.candidateName} site:${domain}`,
      api_key: apiKey,
    });
    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    const payload: any = await response.json();
    if (!response.ok || payload.error)
      return {
        status: "failed",
        reason: payload.error ?? `SerpApi returned HTTP ${response.status}.`,
      };
    const results = Array.isArray(payload.images_results)
      ? payload.images_results
      : [];
    const verified = results
      .filter(
        (result: any) =>
          matchesOfficialDomain(text(result.link), domain) ||
          matchesOfficialDomain(text(result.original), domain) ||
          text(result.source)
            ?.replace(/^www\./, "")
            .includes(domain),
      )
      .slice(0, 4)
      .map((result: any) => ({
        title: text(result.title),
        imageUrl: text(result.original),
        sourcePageUrl: text(result.link),
        source: text(result.source),
      }));
    return {
      status: "complete",
      candidateName: args.candidateName,
      domain,
      verified,
    };
  },
});

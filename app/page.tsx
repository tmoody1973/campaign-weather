"use client";

import { useState } from "react";
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";
import "./press-desk.css";

type Layer = "ads" | "news" | "search";
type AnyRecord = Record<string, any>;

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
const layers: { key: Layer; label: string; description: string }[] = [
  {
    key: "ads",
    label: "Candidate ads",
    description: "Public Google ad records",
  },
  {
    key: "news",
    label: "News context",
    description: "Reporting about the race",
  },
  {
    key: "search",
    label: "Search context",
    description: "What people are looking up locally",
  },
];

const issueDefinitions = [
  {
    key: "data-centers",
    label: "Data centers",
    terms: ["data center", "data-center"],
  },
  {
    key: "taxes",
    label: "Taxes & costs",
    terms: [" tax", "taxes", "affordab", "cost of living", "energy cost"],
  },
  {
    key: "health",
    label: "Health care",
    terms: ["health care", "healthcare", "hospital", "medicaid"],
  },
  {
    key: "education",
    label: "Education",
    terms: ["school", "education", "student", "teacher"],
  },
  {
    key: "housing",
    label: "Housing",
    terms: ["housing", "rent", "home prices", "homeownership"],
  },
  {
    key: "public-safety",
    label: "Public safety",
    terms: ["crime", "public safety", "law enforcement"],
  },
] as const;

function StationMark() {
  return (
    <svg className="station-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" />
      <path d="M16 34h16M19 34l3-17h4l3 17M20 24h8M24 10v7M17 15l7-5 7 5" />
      <circle cx="24" cy="10" r="1.7" fill="currentColor" />
    </svg>
  );
}
function formatDate(value?: number) {
  return value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not yet captured";
}
function formatMoney(value?: number, currency = "USD") {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value)
    : "Not displayed";
}

function interleaveByCandidate(records: AnyRecord[]) {
  const queues = new Map<string, AnyRecord[]>();
  for (const record of records) {
    const key =
      record.candidateName ?? record.advertiser ?? "Unattributed advertiser";
    queues.set(key, [...(queues.get(key) ?? []), record]);
  }
  const result: AnyRecord[] = [];
  while ([...queues.values()].some((queue) => queue.length > 0)) {
    for (const queue of queues.values()) {
      const next = queue.shift();
      if (next) result.push(next);
    }
  }
  return result;
}

function publicText(record: AnyRecord) {
  return [
    record.creativeTitle,
    record.creativeHeadline,
    record.creativeLongHeadline,
    record.creativeSnippet,
    record.title,
    record.snippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesIssue(record: AnyRecord, issueKey: string) {
  const issue = issueDefinitions.find((item) => item.key === issueKey);
  if (!issue) return true;
  const text = publicText(record);
  return issue.terms.some((term) => text.includes(term));
}

function FormatMark({ format }: { format: string }) {
  const normalized = format.toLowerCase();
  if (normalized === "video" || normalized === "text") {
    return (
      <span className={`format-mark format-mark-${normalized}`}>
        <img src={`/icons/${normalized}.svg`} alt={`${format} ad`} />
      </span>
    );
  }
  return <span className="format-mark format-word">{format}</span>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
}

function CandidatePortrait({
  name,
  photo,
  compact = false,
}: {
  name: string;
  photo?: AnyRecord | null;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className = `candidate-portrait ${compact ? "compact" : ""}`;
  if (photo?.imageUrl && !failed) {
    return (
      <a
        className={className}
        href={photo.sourcePageUrl}
        target="_blank"
        rel="noreferrer"
        title={`Source-linked candidate portrait (${photo.status.replaceAll("_", " ")})`}
        aria-label={`Open ${name}'s portrait source`}
      >
        <img src={photo.imageUrl} alt={name} onError={() => setFailed(true)} />
      </a>
    );
  }
  return (
    <span
      className={`${className} unavailable`}
      title="No candidate portrait is available in the supplied manifest."
      aria-label={`${name}: portrait unavailable in the supplied manifest`}
    >
      {initials(name)}
    </span>
  );
}

function LivingBrief({
  brief,
  onRefresh,
  updating,
  message,
}: {
  brief: AnyRecord | null | undefined;
  onRefresh: () => void;
  updating: boolean;
  message: string | null;
}) {
  return (
    <section
      className={`living-brief ${brief?.outcome === "answer" ? "ready" : "empty"}`}
      aria-live="polite"
    >
      <div className="brief-heading">
        <div>
          <h2>The story so far</h2>
          <p>AI reads only the stored public records below.</p>
        </div>
        <button
          className="brief-refresh"
          onClick={onRefresh}
          disabled={updating}
        >
          {updating
            ? "Writing brief…"
            : brief
              ? "Update from stored evidence"
              : "Create plain-English brief"}
        </button>
      </div>
      {brief?.outcome === "answer" ? (
        <>
          <h3>{brief.headline}</h3>
          <p className="brief-summary">{brief.plainSummary}</p>
          {brief.sections?.length > 0 && (
            <section
              className="brief-reader-sections"
              aria-label="Reader's brief"
            >
              {brief.sections.map((section: AnyRecord) => (
                <article key={section.label}>
                  <h4>{section.label}</h4>
                  <p>{section.body}</p>
                  {section.supportingEvidence?.length > 0 && (
                    <div>
                      {section.supportingEvidence.map((source: AnyRecord) => (
                        <a
                          key={source.recordId}
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.title} ↗
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          <dl className="brief-facts">
            <div>
              <dt>What changed</dt>
              <dd>{brief.whatChanged}</dd>
            </div>
            <div>
              <dt>What to watch next</dt>
              <dd>{brief.watchNext}</dd>
            </div>
            <div>
              <dt>What this cannot tell us</dt>
              <dd>{brief.cannotConclude}</dd>
            </div>
          </dl>
          {brief.supportingEvidence?.length > 0 && (
            <div className="brief-sources">
              <b>Evidence used</b>
              {brief.supportingEvidence.map((source: AnyRecord) => (
                <a
                  key={source.recordId}
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.title} ↗
                </a>
              ))}
            </div>
          )}
          <p className="brief-meta">
            Updated {formatDate(brief.createdAt)} · gpt-5-mini · source-linked
            evidence only
          </p>
        </>
      ) : (
        <div className="brief-empty-copy">
          <h3>A readable brief is one click away.</h3>
          <p>
            It will summarize the stored ads, reporting, and search readings in
            plain English, cite the records it used, and name its limits.
          </p>
        </div>
      )}
      {message && <p className="brief-message">{message}</p>}
    </section>
  );
}

function CapturePanel({
  race,
  onFetch,
  onClose,
  refreshing,
  message,
}: {
  race?: AnyRecord;
  onFetch: () => void;
  onClose: () => void;
  refreshing: boolean;
  message: string | null;
}) {
  return (
    <section className="fetch-panel" aria-label="Live race capture controls">
      <div>
        <p>LIVE DEMO CAPTURE</p>
        <h2>{race?.name ?? "Selected race"}</h2>
        <span>{race?.candidates?.join(" · ")}</span>
      </div>
      <div className="fetch-proof">
        <b>2 verified advertiser IDs</b>
        <span>One Google ad request per candidate</span>
      </div>
      <div className="fetch-proof">
        <b>Up to {race?.estimatedSearches ?? 4} searches</b>
        <span>Account check is free. A 40-search reserve is protected.</span>
      </div>
      <button className="live-button" onClick={onFetch} disabled={refreshing}>
        {refreshing ? "Capturing public records…" : "Fetch live evidence"}
      </button>
      <button className="close-fetch" onClick={onClose}>
        Close
      </button>
      {message && (
        <p className="fetch-result" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function AdRow({
  creative,
  onOpen,
}: {
  creative: AnyRecord;
  onOpen: () => void;
}) {
  const candidate = creative.candidateName ?? creative.advertiser;
  return (
    <article className="creative-row">
      <button onClick={onOpen} aria-label={`Inspect ${candidate} public ad`}>
        <FormatMark format={creative.format} />
        <span className="creative-row-copy">
          <b>{candidate}</b>
          <em>
            {creative.targetDomain
              ? `Links to ${creative.targetDomain}`
              : "Public creative record"}
          </em>
        </span>
        <span className="creative-reading">
          <small>SHOWN</small>
          <b>
            {creative.minimumViews && creative.maximumViews
              ? `${creative.minimumViews.toLocaleString()}–${creative.maximumViews.toLocaleString()}`
              : "Not displayed"}
          </b>
        </span>
        <span className="creative-reading">
          <small>SPENT</small>
          <b>
            {creative.minimumSpend && creative.maximumSpend
              ? `${creative.minimumSpend}–${creative.maximumSpend}`
              : "Not displayed"}
          </b>
        </span>
        <span className="inspect-action">Inspect →</span>
      </button>
      <footer>
        <span>
          Google public record · ranges are not unique people or exact totals
        </span>
        <a href={creative.detailsLink} target="_blank" rel="noreferrer">
          Open source ↗
        </a>
      </footer>
    </article>
  );
}

function EvidenceDrawer({
  layer,
  record,
  profile,
  onClose,
  onLoadDetails,
  detailsLoading,
  detailsMessage,
}: {
  layer: Layer;
  record: AnyRecord;
  profile?: AnyRecord;
  onClose: () => void;
  onLoadDetails: () => void;
  detailsLoading: boolean;
  detailsMessage: string | null;
}) {
  const isAd = layer === "ads";
  const sourceUrl = isAd
    ? record.detailsLink
    : layer === "news"
      ? record.url
      : "https://trends.google.com/trends/";
  const title = isAd
    ? `${record.candidateName ?? record.advertiser} public ad`
    : layer === "news"
      ? record.title
      : `${record.term} search interest`;
  return (
    <aside className="evidence-drawer" aria-live="polite">
      <button className="drawer-close" onClick={onClose}>
        Close ×
      </button>
      <span className="source-label">
        {isAd
          ? "AD PASSPORT"
          : layer === "news"
            ? "NEWS CONTEXT"
            : "SEARCH READING"}
      </span>
      {isAd && (record.mediaUrl ?? record.previewImage) && (
        <img
          className="drawer-image"
          src={record.mediaUrl ?? record.previewImage}
          alt={`Public preview for ${title}`}
        />
      )}
      <h2>{title}</h2>
      <p>
        {isAd
          ? (record.creativeHeadline ??
            record.creativeLongHeadline ??
            record.creativeTitle ??
            "This is a public Google Ads Transparency record. The ranges below come from Google and do not represent unique people or persuasion.")
          : layer === "news"
            ? (record.snippet ??
              `${record.outlet} · ${record.dateLabel ?? "date not displayed"}`)
            : `Latest Google Trends index: ${record.latestValue ?? "not displayed"}. It measures relative search interest, not support.`}
      </p>
      {isAd && (
        <>
          <div className="reading-pairs">
            <span>
              <small>AMOUNT SPENT</small>
              <b>
                {record.minimumSpend && record.maximumSpend
                  ? `${record.minimumSpend}–${record.maximumSpend}`
                  : "NOT DISPLAYED"}
              </b>
              <em>Range reported by Google</em>
            </span>
            <span>
              <small>TIMES SHOWN</small>
              <b>
                {record.minimumViews && record.maximumViews
                  ? `${record.minimumViews.toLocaleString()}–${record.maximumViews.toLocaleString()}`
                  : "NOT DISPLAYED"}
              </b>
              <em>Not unique people</em>
            </span>
          </div>
          {record.creativeSnippet && (
            <div className="creative-copy">
              <small>PUBLIC CREATIVE COPY</small>
              <p>{record.creativeSnippet}</p>
              {(record.visibleLink ?? record.destinationUrl) && (
                <a
                  href={record.destinationUrl ?? record.detailsLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  {record.visibleLink ?? "Open advertised destination"} ↗
                </a>
              )}
              {record.callToAction && (
                <em>Call to action: {record.callToAction}</em>
              )}
              {record.videoDuration && (
                <em>Video duration: {record.videoDuration}</em>
              )}
            </div>
          )}
          {!record.detailsFetchedAt && (
            <button
              className="drawer-detail-fetch"
              onClick={onLoadDetails}
              disabled={detailsLoading}
            >
              {detailsLoading
                ? "Loading public creative content…"
                : "Load public creative content · uses 1 search"}
            </button>
          )}
          {detailsMessage && (
            <p className="drawer-detail-message">{detailsMessage}</p>
          )}
          {record.detailsFetchedAt &&
            !record.creativeSnippet &&
            !record.creativeHeadline &&
            !record.mediaUrl && (
              <p className="drawer-detail-message">
                Google’s public detail response did not include copy or media
                for this creative. The original record remains available below.
              </p>
            )}
        </>
      )}
      {profile && (
        <div className="drawer-profile">
          <b>Separate advertiser overview</b>
          <p>
            {profile.candidateName}:{" "}
            {formatMoney(profile.reportedSpend, profile.currency)} across{" "}
            {profile.reportedAdCount} ads in {profile.scopeLabel}. This is not
            the sum of creative ranges.
          </p>
        </div>
      )}
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        Open original public source ↗
      </a>
    </aside>
  );
}

function SearchContext({
  trends,
  scope,
  geo,
  onOpenNews,
}: {
  trends: AnyRecord[];
  scope: string;
  geo?: string;
  onOpenNews: () => void;
}) {
  const readings = trends
    .filter((item) => typeof item.latestValue === "number")
    .sort((left, right) => right.latestValue - left.latestValue);
  const highest = readings[0];
  const lowest = readings.at(-1);
  const gap =
    highest && lowest && readings.length > 1
      ? highest.latestValue - lowest.latestValue
      : 0;
  // A single low or close reading is not a voter-facing conclusion. This is a
  // product threshold for when we describe a comparison, not a popularity or
  // support threshold.
  const hasClearComparison =
    Boolean(highest && lowest) && highest.latestValue >= 10 && gap >= 10;
  const trendsUrl = `https://trends.google.com/trends/explore?geo=${encodeURIComponent(geo ?? "US")}`;

  return (
    <section className="explorer search-context">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LOCAL SEARCH CONTEXT</span>
          <h2>What people are looking up locally</h2>
          <p>
            {scope}. Google Trends is a relative index within this comparison,
            not a poll, audience size, or sign of support.
          </p>
        </div>
      </div>
      {readings.length ? (
        <>
          <section
            className={`search-read ${hasClearComparison ? "signal" : "quiet"}`}
            aria-label="Search context summary"
          >
            <div>
              <span>HOW TO READ THIS</span>
              <h3>
                {hasClearComparison
                  ? `${highest.term} has the higher latest local search reading.`
                  : "No clear search difference to read into yet."}
              </h3>
              <p>
                {hasClearComparison
                  ? `The latest comparison is ${highest.latestValue} for ${highest.term} and ${lowest?.latestValue} for ${lowest?.term}. Treat that as a cue to check reporting and public ads—not evidence of support, persuasion, or likely results.`
                  : `The latest readings are ${readings.map((item) => `${item.term}: ${item.latestValue}`).join(" · ")}. Campaign Weather does not turn a small or close gap into a story about voters.`}
              </p>
            </div>
            <div className="search-actions">
              <button onClick={onOpenNews}>Read local reporting →</button>
              <a href={trendsUrl} target="_blank" rel="noreferrer">
                Open Google Trends ↗
              </a>
            </div>
          </section>
          <section
            className="trend-compare"
            aria-label="Latest relative search readings"
          >
            {readings.map((item) => (
              <article key={item._id}>
                <div>
                  <b>{item.term}</b>
                  <strong>{item.latestValue}</strong>
                </div>
                <div
                  className="trend-bar"
                  role="img"
                  aria-label={`${item.term}: ${item.latestValue} out of 100 relative search interest`}
                >
                  <i style={{ width: `${Math.max(item.latestValue, 3)}%` }} />
                </div>
                <p>Latest reading in this state-and-time-window comparison.</p>
              </article>
            ))}
          </section>
          <p className="search-limit">
            Useful for: noticing a possible moment to investigate. Not useful
            for: deciding who is ahead, what voters think, or which issue they
            care about most.
          </p>
        </>
      ) : (
        <EmptyState text="No local Google Trends comparison has been stored yet." />
      )}
    </section>
  );
}

function PressDesk({
  radar,
  brief,
  onReturn,
}: {
  radar: AnyRecord | null | undefined;
  brief: AnyRecord | null | undefined;
  onReturn: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const reportable = (radar?.changes ?? []).filter(
    (change: AnyRecord) => change.reportable,
  );
  const raceName = radar?.race?.name ?? "Selected race";
  const latestCapture = radar?.captures?.ads?.capturedAt;
  const sourceByUrl = new Map<string, AnyRecord>();
  for (const source of brief?.supportingEvidence ?? []) {
    sourceByUrl.set(source.sourceUrl, source);
  }
  for (const change of reportable) {
    for (const sourceUrl of change.evidenceUrls ?? []) {
      if (!sourceByUrl.has(sourceUrl)) {
        sourceByUrl.set(sourceUrl, {
          recordId: sourceUrl,
          sourceUrl,
          title: "Public source record",
        });
      }
    }
  }
  const evidencePack = [...sourceByUrl.values()];
  const candidateAdSummary = (radar?.race?.candidates ?? []).map(
    (candidate: AnyRecord) => {
      const records = (radar?.creatives ?? []).filter(
        (creative: AnyRecord) => creative.candidateName === candidate.name,
      );
      return {
        ...candidate,
        count: records.length,
        formats: [
          ...new Set(records.map((record: AnyRecord) => record.format)),
        ],
        sourceUrl: records[0]?.detailsLink,
      };
    },
  );
  const issueLead = issueDefinitions.find((issue) =>
    (radar?.newsItems ?? []).some((item: AnyRecord) =>
      matchesIssue(item, issue.key),
    ),
  );
  const storyLead =
    brief?.headline ??
    (reportable.length
      ? "A source-backed change is ready for review"
      : "No confirmed change since the last comparable check");
  const storyDeck =
    brief?.plainSummary ??
    "Campaign Weather has stored public campaign and reporting records for this race. Open the evidence below before making a reporting claim.";
  const reporterNote = [
    `Campaign Weather reporter briefing: ${raceName}`,
    "",
    storyLead,
    storyDeck,
    "",
    `What changed: ${brief?.whatChanged ?? "No reportable change has been confirmed."}`,
    `Limit: ${brief?.cannotConclude ?? "Public records do not establish voter opinion, reach, or impact."}`,
    "",
    "Source links:",
    ...evidencePack.map((source) => `- ${source.title}: ${source.sourceUrl}`),
  ].join("\n");
  async function copyReporterNote() {
    try {
      await navigator.clipboard.writeText(reporterNote);
      setCopyStatus("Reporter note copied with source links.");
    } catch {
      setCopyStatus("Copy was blocked. Select the source links below instead.");
    }
  }
  return (
    <section className="reporter-desk">
      <div className="reporter-header">
        <div>
          <span>REPORTER BRIEFING · SOURCE-LINKED</span>
          <h1>{raceName}</h1>
          <p>
            A reporting starting point—not a story verdict. Every claim below
            links to a public record.
          </p>
        </div>
        <button onClick={onReturn}>← Voter view</button>
      </div>
      <section className="reporter-lead">
        <div>
          <span>STORY LEAD</span>
          <h2>{storyLead}</h2>
          <p>{storyDeck}</p>
        </div>
        <aside>
          <span>LATEST PUBLIC CHECK</span>
          <b>{formatDate(latestCapture)}</b>
          <p>
            {reportable.length} source-qualified change
            {reportable.length === 1 ? "" : "s"} in this briefing.
          </p>
          <button onClick={copyReporterNote}>Copy reporter note</button>
          {copyStatus && <small>{copyStatus}</small>}
        </aside>
      </section>
      <section className="reporter-grid">
        <article className="reporter-section change-summary">
          <header>
            <span>WHAT CHANGED</span>
            <p>Only changes that pass a visible rule appear here.</p>
          </header>
          {reportable.length ? (
            reportable.map((change: AnyRecord) => (
              <div className="change-card" key={change._id}>
                <b>{change.kind.replaceAll("_", " ")}</b>
                <p>{change.rule}</p>
                <small>
                  {change.evidenceUrls?.length ?? 0} public source link
                  {change.evidenceUrls?.length === 1 ? "" : "s"} available in
                  the evidence pack.
                </small>
              </div>
            ))
          ) : (
            <div className="change-card">
              <b>Baseline only</b>
              <p>
                The first comparable check is the starting point. A later check
                is needed before this desk calls a change.
              </p>
            </div>
          )}
        </article>
        <article className="reporter-section reporter-limit">
          <header>
            <span>REPORTING GUARDRAIL</span>
          </header>
          <p>
            {brief?.cannotConclude ??
              "Public ads, news results, and search activity do not establish voter opinion, unique reach, persuasion, or a likely outcome."}
          </p>
          <b>
            Use this as a lead. Verify the original source before publishing.
          </b>
        </article>
      </section>
      <section className="reporter-section evidence-pack">
        <header>
          <div>
            <span>EVIDENCE PACK</span>
            <h2>Open the records behind this briefing</h2>
          </div>
          <p>
            {evidencePack.length} direct public source link
            {evidencePack.length === 1 ? "" : "s"}
          </p>
        </header>
        {evidencePack.length ? (
          <div className="evidence-pack-list">
            {evidencePack.map((source) => (
              <a
                href={source.sourceUrl}
                key={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  {source.recordId?.startsWith("ad:")
                    ? "PUBLIC AD"
                    : source.recordId?.startsWith("news:")
                      ? "NEWS REPORT"
                      : "PUBLIC SOURCE"}
                </span>
                <b>{source.title}</b>
                <em>Open source ↗</em>
              </a>
            ))}
          </div>
        ) : (
          <p className="reporter-empty">
            Fetch a public race capture to build an evidence pack.
          </p>
        )}
      </section>
      <section className="reporter-bottom-grid">
        <article className="reporter-section ad-angle">
          <header>
            <div>
              <span>PUBLIC AD SNAPSHOT</span>
              <h2>What each campaign has put online</h2>
            </div>
            <p>Counts are individual public records, not estimated audience.</p>
          </header>
          <div className="candidate-ad-summary">
            {candidateAdSummary.map((candidate: AnyRecord) => (
              <article key={candidate.name}>
                <span>{candidate.name}</span>
                <b>
                  {candidate.count} public ad record
                  {candidate.count === 1 ? "" : "s"}
                </b>
                <p>
                  {candidate.formats.length
                    ? `Formats: ${candidate.formats.join(", ")}.`
                    : "No public ad record is stored in this capture."}
                </p>
                {candidate.sourceUrl && (
                  <a
                    href={candidate.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open an ad record ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        </article>
        <aside className="reporter-section reporting-prompts">
          <header>
            <span>QUESTIONS TO PURSUE</span>
            <p>Reporting prompts, not AI conclusions.</p>
          </header>
          <ul>
            <li>
              {issueLead
                ? `What are the candidates publicly saying about ${issueLead.label.toLowerCase()}?`
                : "What topic is showing up repeatedly in local reporting?"}
            </li>
            <li>Do newly observed ads change after the next public check?</li>
            <li>
              Which claims in the public ads deserve independent verification?
            </li>
          </ul>
        </aside>
      </section>
    </section>
  );
}

function VoterRadar() {
  const demoRaces = useQuery(api.campaignWeather.listDemoRaces);
  const [raceKey, setRaceKey] = useState("wi-governor-2026");
  const radar = useQuery(api.campaignWeather.getRaceRadar, { key: raceKey });
  const brief = useQuery(api.campaignWeather.getLatestLivingBrief, {
    key: raceKey,
  });
  const refreshRace = useAction(api.ingestion.refreshRace);
  const refreshBrief = useAction(api.briefs.refreshLivingBrief);
  const fetchCreativeDetails = useAction(
    api.creativeDetails.fetchPublicCreativeDetails,
  );
  const [layer, setLayer] = useState<Layer>("ads");
  const [candidate, setCandidate] = useState<string | "all">("all");
  const [issue, setIssue] = useState<string | "all">("all");
  const [drawer, setDrawer] = useState<AnyRecord>();
  const [showCapture, setShowCapture] = useState(false);
  const [pressDesk, setPressDesk] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [briefUpdating, setBriefUpdating] = useState(false);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [briefMessage, setBriefMessage] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<string | null>(null);
  const activeDemo = demoRaces?.find((race: AnyRecord) => race.key === raceKey);
  const trendScope = activeDemo
    ? `${activeDemo.state} · ${activeDemo.trendWindow ?? "Last 3 months"}`
    : "Selected race · Last 3 months";
  const candidates = radar?.race?.candidates ?? activeDemo?.candidates ?? [];
  const photoForCandidate = (name: string) =>
    activeDemo?.candidates?.find(
      (candidate: AnyRecord) => candidate.name === name,
    )?.photo ?? null;
  const ads = radar?.creatives ?? [];
  const news = radar?.newsItems ?? [];
  const trends = radar?.trendItems ?? [];
  const availableIssues = issueDefinitions
    .map((definition) => ({
      ...definition,
      adCount: ads.filter((record: AnyRecord) =>
        matchesIssue(record, definition.key),
      ).length,
      newsCount: news.filter((record: AnyRecord) =>
        matchesIssue(record, definition.key),
      ).length,
    }))
    .filter((definition) => definition.adCount + definition.newsCount > 0);
  const visibleAds =
    candidate === "all"
      ? interleaveByCandidate(ads)
      : ads.filter(
          (creative: AnyRecord) => creative.candidateName === candidate,
        );
  const issueFilteredAds =
    issue === "all"
      ? visibleAds
      : visibleAds.filter((record: AnyRecord) => matchesIssue(record, issue));
  const issueFilteredNews =
    issue === "all"
      ? news
      : news.filter((record: AnyRecord) => matchesIssue(record, issue));
  const selectedIssue = availableIssues.find((item) => item.key === issue);
  const activeDrawer = drawer
    ? (ads.find((creative: AnyRecord) => creative._id === drawer._id) ?? drawer)
    : undefined;
  const total =
    layer === "ads"
      ? ads.length
      : layer === "news"
        ? news.length
        : trends.length;
  const currentLayerSummary =
    layer === "ads"
      ? {
          title: `${total} campaign ad${total === 1 ? "" : "s"} to look at`,
          description: "See what each campaign is putting online.",
        }
      : layer === "news"
        ? {
            title: `${total} local news stor${total === 1 ? "y" : "ies"}`,
            description: "Read what reporters are saying about the race.",
          }
        : {
            title: `${total} candidate-name check${total === 1 ? "" : "s"}`,
            description: "A small clue about curiosity, not a vote count.",
          };
  const selectedProfile = activeDrawer
    ? (radar?.advertiserProfiles ?? []).find(
        (profile: AnyRecord) =>
          profile.candidateName === activeDrawer.candidateName,
      )
    : undefined;
  async function fetchEvidence() {
    setRefreshing(true);
    setCaptureMessage(null);
    try {
      const result = await refreshRace({ raceKey });
      setCaptureMessage(
        result.status === "complete"
          ? `Saved ${result.outcomes?.ads?.count ?? 0} ads, ${result.outcomes?.news?.count ?? 0} news records, and ${result.outcomes?.trends?.count ?? 0} search readings.`
          : (result.reason ?? "The capture did not complete."),
      );
    } catch (error) {
      setCaptureMessage(
        error instanceof Error
          ? error.message
          : "The capture did not complete.",
      );
    } finally {
      setRefreshing(false);
    }
  }
  async function makeBrief() {
    setBriefUpdating(true);
    setBriefMessage(null);
    try {
      const result = await refreshBrief({ raceKey });
      setBriefMessage(
        result.status === "complete"
          ? `Brief updated from ${result.supportingEvidenceCount} stored source record${result.supportingEvidenceCount === 1 ? "" : "s"}.`
          : (result.reason ?? "The brief could not be created."),
      );
    } catch (error) {
      setBriefMessage(
        error instanceof Error
          ? error.message
          : "The brief could not be created.",
      );
    } finally {
      setBriefUpdating(false);
    }
  }
  async function loadCreativeDetails() {
    if (!activeDrawer?._id) return;
    setDetailsLoading(true);
    setDetailsMessage(null);
    try {
      const result = await fetchCreativeDetails({
        creativeId: activeDrawer._id,
      });
      setDetailsMessage(
        result.status === "complete"
          ? result.cached
            ? "This public creative detail was already stored."
            : "Stored the public creative detail response with this evidence record."
          : (result.reason ??
              "The public creative detail could not be loaded."),
      );
    } catch (error) {
      setDetailsMessage(
        error instanceof Error
          ? error.message
          : "The public creative detail could not be loaded.",
      );
    } finally {
      setDetailsLoading(false);
    }
  }
  return (
    <main className="station-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setPressDesk(false)}
          aria-label="Open Voter Radar"
        >
          <StationMark />
          <span>
            <b>Campaign Weather</b>
            <small>Great Lakes Field Station</small>
          </span>
        </button>
        <div className="race-title">
          <b>
            {radar?.race?.name ?? activeDemo?.name ?? "Wisconsin Governor 2026"}
          </b>
          <small>
            {candidates.map((item: AnyRecord) => item.name).join(" / ")}
          </small>
          <span className="race-portraits" aria-label="Candidate portraits">
            {candidates.map((item: AnyRecord) => (
              <CandidatePortrait
                key={item.name}
                name={item.name}
                photo={photoForCandidate(item.name)}
                compact
              />
            ))}
          </span>
        </div>
        <div className="capture">
          <i />
          FACTS YOU CAN CHECK · NO PREDICTIONS
        </div>
        <label className="race-switch">
          <span className="sr-only">Choose a demo race</span>
          <select
            value={raceKey}
            onChange={(event) => {
              setRaceKey(event.target.value);
              setCandidate("all");
              setDrawer(undefined);
              setBriefMessage(null);
            }}
          >
            <option value="wi-governor-2026">Wisconsin Governor</option>
            {demoRaces
              ?.filter((race: AnyRecord) => race.key !== "wi-governor-2026")
              .map((race: AnyRecord) => (
                <option value={race.key} key={race.key}>
                  {race.name}
                </option>
              ))}
          </select>
        </label>
        <div className="topbar-actions">
          <a className="about-link" href="/about">
            What is this?
          </a>
          <button
            className="fetch-trigger"
            onClick={() => setShowCapture((value) => !value)}
          >
            <span className="fetch-dot" />
            Fetch race
          </button>
        </div>
      </header>
      {showCapture && (
        <CapturePanel
          race={activeDemo}
          onFetch={fetchEvidence}
          onClose={() => setShowCapture(false)}
          refreshing={refreshing}
          message={captureMessage}
        />
      )}
      {pressDesk ? (
        <PressDesk
          radar={radar}
          brief={brief}
          onReturn={() => setPressDesk(false)}
        />
      ) : (
        <section className="voter-page">
          <div className="voter-hero">
            <div>
              <h1>Know what’s happening in your race.</h1>
              <p className="hero-copy">
                See campaign ads, local news, and what people are searching for
                in one place. Campaign Weather helps you look at the facts—it
                never tells you who to vote for.
              </p>
            </div>
            <aside className="how-to">
              <b>Start here</b>
              <ol>
                <li>Get the quick story.</li>
                <li>Look at the ads and news.</li>
                <li>Make up your own mind.</li>
              </ol>
            </aside>
          </div>
          <section className="snapshot-strip">
            <article>
              <span>IN THIS UPDATE</span>
              <b>{currentLayerSummary.title}</b>
              <p>{currentLayerSummary.description}</p>
            </article>
            <article>
              <span>WHAT THIS APP DOES</span>
              <b>
                {radar?.captures?.ads
                  ? "It helps you check the facts."
                  : "It starts with public information."}
              </b>
              <p>
                {radar?.captures?.ads
                  ? "Use the story and source links to learn more."
                  : "Choose a race and we’ll show what is publicly available."}
              </p>
            </article>
            <article>
              <span>LAST UPDATED</span>
              <b>
                {formatDate(
                  radar?.captures?.[layer === "search" ? "trends" : layer]
                    ?.capturedAt,
                )}
              </b>
              <p>Based on public campaign and news information.</p>
            </article>
          </section>
          <LivingBrief
            brief={brief}
            onRefresh={makeBrief}
            updating={briefUpdating}
            message={briefMessage}
          />
          <section className="issue-lens" aria-label="Issues in public view">
            <div>
              <h2>Issues in public view</h2>
              <p>
                These labels group exact words found in stored public ads or
                reporting. They do not describe a full platform or tell you what
                matters most to voters.
              </p>
            </div>
            <div className="issue-controls">
              <button
                className={issue === "all" ? "selected" : ""}
                onClick={() => setIssue("all")}
              >
                All public records
              </button>
              {availableIssues.map((item) => (
                <button
                  key={item.key}
                  className={issue === item.key ? "selected" : ""}
                  onClick={() => {
                    setIssue(item.key);
                    setLayer(item.newsCount > 0 ? "news" : "ads");
                  }}
                >
                  {item.label} <span>{item.adCount + item.newsCount}</span>
                </button>
              ))}
            </div>
            {selectedIssue && (
              <p className="issue-result">
                Showing <b>{selectedIssue.label}</b> in stored public text:{" "}
                {selectedIssue.adCount} ad record
                {selectedIssue.adCount === 1 ? "" : "s"} and{" "}
                {selectedIssue.newsCount} news record
                {selectedIssue.newsCount === 1 ? "" : "s"}.
              </p>
            )}
          </section>
          <nav className="layer-tabs" aria-label="Choose evidence type">
            {layers.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setLayer(item.key);
                  setDrawer(undefined);
                }}
                className={layer === item.key ? "selected" : ""}
              >
                <b>{item.label}</b>
                <span>{item.description}</span>
              </button>
            ))}
          </nav>
          {layer === "ads" ? (
            <section className="explorer">
              <div className="section-heading">
                <div>
                  <h2>What public ads can I examine?</h2>
                  <p>
                    These are individual public ad records. Spend and
                    times-shown values are Google’s ranges, not exact totals or
                    unique people.
                  </p>
                </div>
              </div>
              <div className="candidate-tabs">
                <button
                  className={candidate === "all" ? "selected" : ""}
                  onClick={() => setCandidate("all")}
                >
                  All candidates <span>{ads.length}</span>
                </button>
                {candidates.map((item: AnyRecord) => (
                  <button
                    key={item.name}
                    className={candidate === item.name ? "selected" : ""}
                    onClick={() => setCandidate(item.name)}
                  >
                    <CandidatePortrait
                      name={item.name}
                      photo={photoForCandidate(item.name)}
                      compact
                    />
                    {item.name}{" "}
                    <span>
                      {
                        ads.filter(
                          (creative: AnyRecord) =>
                            creative.candidateName === item.name,
                        ).length
                      }
                    </span>
                  </button>
                ))}
              </div>
              {issueFilteredAds.length ? (
                <div className="creative-grid">
                  {issueFilteredAds.map((creative: AnyRecord) => (
                    <AdRow
                      key={creative._id}
                      creative={creative}
                      onOpen={() => setDrawer(creative)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  text={
                    selectedIssue
                      ? `No stored public ad text matches “${selectedIssue.label}” yet. Try News context or open another public creative record.`
                      : "No ad records have been stored for this choice yet. Use Fetch race to request the verified advertiser records."
                  }
                />
              )}
            </section>
          ) : layer === "news" ? (
            <section className="explorer">
              <div className="section-heading">
                <div>
                  <h2>What are news outlets reporting?</h2>
                  <p>
                    Articles add context. They are not campaign ads and do not
                    contain ad-spend details.
                  </p>
                </div>
              </div>
              {issueFilteredNews.length ? (
                <div className="news-list">
                  {issueFilteredNews.slice(0, 8).map((item: AnyRecord) => (
                    <button onClick={() => setDrawer(item)} key={item._id}>
                      <span>
                        {item.outlet} · {item.dateLabel ?? "date not displayed"}
                      </span>
                      <b>{item.title}</b>
                      <p>{item.snippet}</p>
                      <em>Read source →</em>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  text={
                    selectedIssue
                      ? `No stored news context matches “${selectedIssue.label}” yet.`
                      : "No news context has been stored yet."
                  }
                />
              )}
            </section>
          ) : (
            <SearchContext
              trends={trends}
              scope={trendScope}
              geo={activeDemo?.trendGeo}
              onOpenNews={() => {
                setLayer("news");
                setDrawer(undefined);
              }}
            />
          )}
          <section className="field-note">
            <div>
              <h2>Behind the briefing: the source log</h2>
              <p>
                This map is a count of stored records, not a map of voters,
                issue positions, importance, or geography.
              </p>
              <button onClick={() => setPressDesk(true)}>
                Open Press Desk →
              </button>
            </div>
            <FieldMap records={ads.length + news.length + trends.length} />
          </section>
          <div className="bottom-strip">
            <span>
              CAMPAIGN WEATHER / AI-ASSISTED CIVIC EVIDENCE INFRASTRUCTURE
            </span>
            <p>
              Browse-only. No voter profiles, targeting, advice, predictions, or
              inferred political preferences.
            </p>
          </div>
          {activeDrawer && (
            <EvidenceDrawer
              layer={layer}
              record={activeDrawer}
              profile={selectedProfile}
              onClose={() => setDrawer(undefined)}
              onLoadDetails={loadCreativeDetails}
              detailsLoading={detailsLoading}
              detailsMessage={detailsMessage}
            />
          )}
        </section>
      )}
    </main>
  );
}

function FieldMap({ records }: { records: number }) {
  const dots = [
    [262, 128],
    [388, 205],
    [338, 321],
    [186, 294],
    [172, 191],
    [420, 278],
    [236, 349],
    [426, 152],
  ].slice(0, Math.max(1, Math.min(records || 1, 8)));
  return (
    <div
      className="field-map"
      aria-label="A visual count of stored public records"
    >
      <svg
        viewBox="0 0 600 360"
        role="img"
        aria-label={`${records} stored public records`}
      >
        <path
          className="contour"
          d="M99 166C91 96 180 52 301 56c120 4 211 47 203 113-6 48-67 82-85 130-24 62-103 60-168 43-77-20-160-43-152-176Z"
        />
        <path
          className="contour"
          d="M126 177c-1-53 73-91 177-94 99-3 172 28 172 86 0 48-54 75-73 116-20 43-84 47-140 31-69-20-136-41-136-139Z"
        />
        <g className="axis">
          <path d="M300 37v291M120 183h361M174 67l251 232M174 299L425 67" />
        </g>
        <circle className="ring outer" cx="300" cy="183" r="122" />
        <circle className="ring middle" cx="300" cy="183" r="80" />
        <circle className="ring inner" cx="300" cy="183" r="42" />
        {dots.map(([cx, cy]) => (
          <circle
            className="signal"
            cx={cx}
            cy={cy}
            r="5"
            key={`${cx}-${cy}`}
          />
        ))}
        <circle className="core" cx="300" cy="183" r="7" />
      </svg>
      <p>
        Visual tally only: each dot is one stored record. Position and distance
        have no political meaning.
      </p>
    </div>
  );
}
function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <b>Nothing to interpret yet</b>
      <p>{text}</p>
    </div>
  );
}
export default function Home() {
  return convex ? (
    <ConvexProvider client={convex}>
      <VoterRadar />
    </ConvexProvider>
  ) : (
    <main className="config-error">
      <h1>Campaign Weather needs its Convex public URL.</h1>
    </main>
  );
}

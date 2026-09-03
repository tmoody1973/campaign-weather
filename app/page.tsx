"use client";

import { useState } from "react";
import {
  ConvexProvider,
  ConvexReactClient,
  useAction,
  useQuery,
} from "convex/react";
import { api } from "../convex/_generated/api";

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
    label: "Search attention",
    description: "Google Trends readings",
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
      <span className="format-mark">
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

function PressDesk({
  radar,
  onReturn,
}: {
  radar: AnyRecord | null | undefined;
  onReturn: () => void;
}) {
  const reportable = (radar?.changes ?? []).filter(
    (change: AnyRecord) => change.reportable,
  );
  return (
    <section className="press-desk">
      <div className="press-header">
        <div>
          <span>PRESS DESK / SOURCE-BOUND REPORTING</span>
          <h1>{radar?.race?.state ?? "Race"} evidence ledger</h1>
        </div>
        <button onClick={onReturn}>← Return to Voter Radar</button>
      </div>
      <div className="press-layout">
        <article className="ledger">
          <div className="ledger-bar">
            <b>Reportable changes</b>
            <small>Thresholds are visible. Nothing is inferred.</small>
          </div>
          <table>
            <thead>
              <tr>
                <th>CHANGE</th>
                <th>EVIDENCE</th>
                <th>RULE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {reportable.length ? (
                reportable.map((change: AnyRecord) => (
                  <tr key={change._id}>
                    <td>
                      <span className="change-dot" />
                      {change.kind.replaceAll("_", " ")}
                    </td>
                    <td>
                      {change.evidenceUrls?.length ?? 0} direct source record
                      {change.evidenceUrls?.length === 1 ? "" : "s"}
                    </td>
                    <td>{change.rule}</td>
                    <td>Reportable</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>
                    <span className="change-dot" />
                    Baseline / no qualified change
                  </td>
                  <td>Stored public source records</td>
                  <td>
                    Requires a second comparable snapshot and a stated
                    threshold.
                  </td>
                  <td>Not reportable</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
        <aside className="investigator">
          <span>CONSTRAINED AI BRIEF</span>
          <h2>What public campaign activity changed?</h2>
          <div>
            <b>WHAT CHANGED</b>
            <p>
              {reportable.length
                ? `${reportable.length} threshold-qualified change${reportable.length === 1 ? " was" : "s were"} retained in the source ledger.`
                : "No reportable change has been confirmed. The first valid capture establishes a comparison baseline."}
            </p>
          </div>
          <div>
            <b>WHAT SUPPORTS THIS</b>
            <p>
              Only stored SerpApi records, capture timestamps, and their direct
              public source links are eligible for this brief.
            </p>
          </div>
          <div>
            <b>WHAT WE CANNOT CONCLUDE</b>
            <p>
              Ads and search readings do not establish persuasion, unique people
              reached, voter support, or likely election outcomes.
            </p>
          </div>
          <p className="ai-note">
            <i />
            gpt-5-mini is constrained to stored civic evidence and declines
            political advice.
          </p>
        </aside>
      </div>
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
          PUBLIC EVIDENCE, NOT PREDICTION
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
        <PressDesk radar={radar} onReturn={() => setPressDesk(false)} />
      ) : (
        <section className="voter-page">
          <div className="voter-hero">
            <div>
              <h1>See what campaigns are putting into public view.</h1>
              <p className="hero-copy">
                Start with public ads, then read the reporting and search
                context around the race. Campaign Weather never tells you who to
                support or who will win.
              </p>
            </div>
            <aside className="how-to">
              <b>How to use this</b>
              <ol>
                <li>Read the living brief.</li>
                <li>Open the sources behind it.</li>
                <li>Decide what matters to you.</li>
              </ol>
            </aside>
          </div>
          <section className="snapshot-strip">
            <article>
              <span>WHAT WE FOUND</span>
              <b>
                {total}{" "}
                {layer === "ads"
                  ? "public ad records"
                  : layer === "news"
                    ? "news records"
                    : "search readings"}
              </b>
              <p>
                From the latest{" "}
                {layers.find((item) => item.key === layer)?.label.toLowerCase()}{" "}
                capture.
              </p>
            </article>
            <article>
              <span>WHAT IT MEANS</span>
              <b>
                {radar?.captures?.ads
                  ? "A snapshot, not a verdict"
                  : "No snapshot yet"}
              </b>
              <p>
                {radar?.captures?.ads
                  ? "A second comparable capture is needed before Campaign Weather labels a change."
                  : "Use Fetch race to begin with verified public sources."}
              </p>
            </article>
            <article>
              <span>LAST CAPTURE</span>
              <b>
                {formatDate(
                  radar?.captures?.[layer === "search" ? "trends" : layer]
                    ?.capturedAt,
                )}
              </b>
              <p>All raw provider records are retained for comparison.</p>
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
            <section className="explorer">
              <div className="section-heading">
                <div>
                  <h2>What is relative search attention?</h2>
                  <p>
                    {trendScope}. Google Trends indexes relative interest from
                    0–100. It is not a poll, audience size, or sign of support.
                  </p>
                </div>
              </div>
              {trends.length ? (
                <div className="trend-grid">
                  {trends.map((item: AnyRecord) => (
                    <button onClick={() => setDrawer(item)} key={item._id}>
                      <span>{item.term}</span>
                      <b>{item.latestValue ?? "—"}</b>
                      <p>{trendScope} relative search-interest index</p>
                      <em>Open explanation →</em>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState text="No Trends comparison has been stored yet." />
              )}
            </section>
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

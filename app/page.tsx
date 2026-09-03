"use client";

import { useEffect, useState } from "react";

type Layer = "ads" | "news" | "search";

const readings = {
  ads: { name: "Public ad activity", note: "Google Ads Transparency readings", color: "cyan" },
  news: { name: "News context", note: "Google News evidence records", color: "lime" },
  search: { name: "Search attention", note: "Google Trends comparison", color: "orange" },
} as const;

const records = [
  { kind: "AD ACTIVITY", candidate: "David Crowley video creative", note: "Observed public creative metadata · 3M–3.5M views", tone: "cyan", source: "https://adstransparency.google.com/advertiser/AR00233328882948767745/creative/CR06872445142482026497?region=US&start-date=2026-08-12&end-date=2026-09-04&domain=crowleyforwi.com" },
  { kind: "AD ACTIVITY", candidate: "Tom Tiffany creative record", note: "Verified advertiser ID · live reading ready", tone: "cyan", source: "https://adstransparency.google.com/advertiser/AR15612586122486480897" },
  { kind: "NEWS CONTEXT", candidate: "Wisconsin governor debate coverage", note: "Stored public race context · does not measure voter opinion", tone: "lime", source: "https://news.google.com/search?q=Tom%20Tiffany%20David%20Crowley%20Wisconsin%20governor" },
];

function StationMark() {
  return <svg className="station-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><path d="M16 34h16M19 34l3-17h4l3 17M20 24h8M24 10v7M17 15l7-5 7 5"/><circle cx="24" cy="10" r="1.7" fill="currentColor"/></svg>;
}

function Radar({ layer }: { layer: Layer }) {
  const dots = layer === "ads" ? [[275,133],[372,202],[335,332],[194,302],[170,194],[412,286]] : layer === "news" ? [[245,185],[333,153],[404,244],[302,331],[198,251],[378,336]] : [[322,216],[400,170],[426,316],[228,348],[152,274],[205,160]];
  return <div className={`radar ${readings[layer].color}`} aria-label={`${readings[layer].name} radar`}>
    <div className="radar-meta"><span>42.96° N / 87.91° W</span><span>READING WINDOW · 03 SEP 2026</span></div>
    <svg viewBox="0 0 600 480" role="img" aria-label={`${readings[layer].name} visualized as a field reading`}>
      <path className="contour" d="M86 212C80 124 180 69 300 73c129 4 221 53 216 139-3 69-69 117-83 179-17 75-103 83-172 70-82-16-165-54-175-146Z"/><path className="contour" d="M111 217c-2-70 86-119 190-122 114-4 191 38 191 117 0 62-56 103-72 153-15 51-89 65-153 49-74-19-154-50-156-147Z"/><path className="contour" d="M141 225c8-56 84-98 164-98 89 0 158 30 160 97 2 47-42 80-60 118-20 42-77 51-134 34-60-18-142-48-130-134Z"/>
      <g className="axis"><path d="M300 52v376M112 240h376M166 106l268 268M166 374l268-268"/></g><circle className="ring outer" cx="300" cy="240" r="145"/><circle className="ring middle" cx="300" cy="240" r="100"/><circle className="ring inner" cx="300" cy="240" r="55"/><path className="beam" d="M300 240 444 149A171 171 0 0 1 461 240Z"/>
      {dots.map(([cx,cy], i) => <circle className="signal" cx={cx} cy={cy} r={i % 3 === 0 ? 5 : 4} key={`${cx}-${cy}`}/>)}<circle className="core-halo" cx="300" cy="240" r="18"/><circle className="core" cx="300" cy="240" r="7"/>
    </svg><span className="compass north">N</span><span className="compass east">E</span><span className="compass south">S</span><span className="compass west">W</span><div className="radar-readout"><span>ACTIVE CHANNEL</span><strong>{readings[layer].name}</strong><em>Open source-bound record ↗</em></div><p className="radar-foot">Each point is a stored public record—not an inference about voters.</p>
  </div>;
}

export default function Home() {
  const [layer, setLayer] = useState<Layer>("ads"); const [pressDesk, setPressDesk] = useState(false); const [selected, setSelected] = useState(0); const active = records[selected];
  useEffect(() => {
    const passport = document.querySelector<HTMLElement>(".passport");
    const heading = passport?.querySelector<HTMLElement>("div b");
    const readings = passport?.querySelector<HTMLElement>(".reading-pairs");
    const link = passport?.querySelector<HTMLAnchorElement>("a");
    if (!heading || !readings || !link) return;
    const isAd = active.kind === "AD ACTIVITY";
    heading.textContent = isAd ? "Ad Passport" : "Evidence Record";
    readings.hidden = !isAd;
    link.href = active.source;
    link.textContent = isAd ? "Open public ad source ↗" : "Open stored context source ↗";
  }, [active]);
  return <main className="station-shell"><header className="topbar"><button className="brand" onClick={() => setPressDesk(false)} aria-label="Open voter radar"><StationMark/><span><b>Campaign Weather</b><small>Great Lakes Field Station</small></span></button><div className="race-title"><b>Wisconsin Governor · 2026</b><small>TOM TIFFANY / DAVID CROWLEY</small></div><div className="capture"><i/>LIVE EVIDENCE CAPTURE</div><button className="race-switch">Wisconsin Governor <span>⌄</span></button><button className="menu" aria-label="Open menu"><i/><i/><i/></button></header>
    {pressDesk ? <section className="press-desk"><div className="press-header"><div><span>PRESS DESK / SOURCE-BOUND REPORTING</span><h1>Evidence ledger</h1></div><button onClick={() => setPressDesk(false)}>← Return to Voter Radar</button></div><div className="press-layout"><article className="ledger"><div className="ledger-bar"><b>Reportable changes</b><small>Thresholds are visible. Nothing is inferred.</small></div><table><thead><tr><th>CHANGE</th><th>EVIDENCE</th><th>RULE</th><th>SCOPE</th></tr></thead><tbody><tr><td><span className="change-dot"/>Baseline only</td><td>Valid Wisconsin ad, news, and trends captures</td><td>Requires a second comparable snapshot</td><td>Public records only</td></tr><tr><td><span className="change-dot"/>Crowley creative</td><td>Google Ads Transparency Center</td><td>Direct source link retained</td><td>Amount spent and times shown are ranges</td></tr></tbody></table></article><aside className="investigator"><span>EVIDENCE INVESTIGATOR</span><h2>What changed in Wisconsin this week?</h2><div><b>WHAT CHANGED</b><p>No reportable change has been confirmed. The first valid capture establishes the comparison baseline.</p></div><div><b>WHAT SUPPORTS THIS</b><p>Stored ad readings, source links, and public race-context records are retained for the next comparison.</p></div><div><b>WHAT WE CANNOT CONCLUDE</b><p>Ad ranges do not establish persuasion, unique people reached, voter support, or likely election outcomes.</p></div><p className="ai-note"><i/>GPT‑5 mini is restricted to stored SerpApi evidence.</p></aside></div></section> : <section className="radar-page"><aside className="channel-rail"><div className="rail-title"><b>Signal layers</b><small>SELECT AN INSTRUMENT</small></div>{(Object.keys(readings) as Layer[]).map((key, index) => <button className={`channel ${layer === key ? "active" : ""}`} key={key} onClick={() => setLayer(key)}><i>{String(index + 1).padStart(2,"0")}</i><span><b>{readings[key].name}</b><small>{readings[key].note}</small></span></button>)}<div className="legend"><span><i className="cyan-dot"/>source-bound record</span><span><i className="hollow-dot"/>context only</span><span><i className="cross"/>not a voter inference</span></div></aside><Radar layer={layer}/><aside className="logbook"><div className="logbook-title"><b>Field log</b><small>03 SEP · 06:17 CDT</small></div><div className="entries">{records.map((record, index) => <button className={`entry ${selected === index ? "selected" : ""}`} key={record.candidate} onClick={() => setSelected(index)}><i className={record.tone}/><span><small>{record.kind}</small><b>{record.candidate}</b><em>{record.note}</em></span></button>)}</div><footer>Capture source: SerpApi<br/>Raw provider records retained</footer></aside><section className="instrument-row"><button><span className="instrument-index">01</span><span><b>Latest reading</b><small>{readings[layer].name}</small><em>REFRESH · OPERATOR ONLY</em></span></button><button><span className="instrument-index">02</span><span><b>Comparison rule</b><small>New creative, advertiser, activity increase, or issue cluster</small><em>THRESHOLDS · OPEN</em></span></button><button onClick={() => setPressDesk(true)}><StationMark/><span><b>Press Desk</b><small>Open source log and neutral brief</small><em>READ THE LEDGER →</em></span></button></section><aside className="passport"><div><b>Ad Passport</b><small>SELECTED PUBLIC RECORD</small></div><h2>{active.candidate}</h2><p>{active.note}</p><div className="reading-pairs"><span><small>AMOUNT SPENT</small><b>{selected === 0 ? "$60K–$70K" : "NOT DISPLAYED"}</b><em>Range reported by Google</em></span><span><small>TIMES SHOWN</small><b>{selected === 0 ? "1.75M–2M" : "NOT DISPLAYED"}</b><em>Not unique people</em></span></div><a href="https://adstransparency.google.com/advertiser/AR00233328882948767745/creative/CR06872445142482026497?region=US&start-date=2026-08-12&end-date=2026-09-04&domain=crowleyforwi.com" target="_blank" rel="noreferrer">Open public source ↗</a></aside><div className="bottom-strip"><span>CAMPAIGN WEATHER / AI-ASSISTED CIVIC EVIDENCE INFRASTRUCTURE</span><p>Browse-only. No voter profiles, targeting, advice, predictions, or inferred political preferences.</p></div></section>}
  </main>;
}

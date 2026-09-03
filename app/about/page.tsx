import type { Metadata } from "next";
import Link from "next/link";
import "../about.css";

export const metadata: Metadata = {
  title: "What is Campaign Weather?",
  description: "A plain-English guide to Campaign Weather.",
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <header className="about-topbar">
        <Link href="/" className="about-brand">
          <span aria-hidden="true">◉</span>
          <b>Campaign Weather</b>
        </Link>
        <Link href="/" className="about-back">
          Open Voter Radar →
        </Link>
      </header>

      <section className="about-hero">
        <p>WHAT IS THIS?</p>
        <h1>Campaign Weather helps you see the public side of an election.</h1>
        <div className="about-intro">
          <p>
            During an election, campaigns put lots of things online: ads, news
            stories, and search activity. It can be hard to know what you are
            looking at—or where it came from.
          </p>
          <p>
            Campaign Weather gathers those public clues in one place and shows
            you the original source. It is a tool for looking closer, not a tool
            for telling you what to think.
          </p>
        </div>
      </section>

      <section className="about-steps" aria-label="How Campaign Weather works">
        <article>
          <span>01</span>
          <h2>Choose a race</h2>
          <p>
            Pick a state and race. The app looks only at that race’s public
            information.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>See the evidence</h2>
          <p>
            You can examine public campaign ads, read recent reporting, and see
            local Google Trends readings.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Check the source</h2>
          <p>
            Every important item has a link back to where it came from, so you
            can judge it for yourself.
          </p>
        </article>
      </section>

      <section className="about-split">
        <div>
          <p>WHY IT MATTERS</p>
          <h2>
            It is easier to make sense of a campaign when you can see the
            receipts.
          </h2>
          <p>
            Ads can be expensive, loud, and easy to forget. News can move fast.
            Search interest can change day to day. Keeping public records with
            dates and source links helps voters and journalists compare what
            changed instead of relying on a vague impression.
          </p>
        </div>
        <aside>
          <h2>What it does not do</h2>
          <ul>
            <li>It does not tell you who to vote for.</li>
            <li>It does not predict who will win.</li>
            <li>It does not track you or build a voter profile.</li>
            <li>It does not treat ad views or searches as votes.</li>
          </ul>
        </aside>
      </section>

      <section className="about-ai">
        <p>ABOUT THE AI</p>
        <h2>AI is the note-taker, not the referee.</h2>
        <p>
          The AI can turn the public records already saved in Campaign Weather
          into a short, neutral update: what changed, what supports it, and what
          we still cannot know. It cannot use secret data, give political
          advice, or make up a conclusion.
        </p>
        <Link href="/" className="about-cta">
          Explore the Wisconsin race →
        </Link>
      </section>
    </main>
  );
}

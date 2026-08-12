import './Header.css';

const APPLY_URL = 'https://hacker-house-goa-2026.devfolio.co/?ref=4a55f04bd8';

/**
 * The masthead — a printed ticket-strip pinned to the top of the
 * environment. Warm paper, ink rules, tape corners, a sun mark, the event
 * metadata and an apply CTA: the whole Frame-in-Goa identity in one
 * horizontal band. It floats over the green like a paper object, same
 * language as the poster and the photo treatment.
 */
export function Header() {
  return (
    <header className="masthead">
      <div className="masthead__strip">
        <span className="masthead__tape masthead__tape--tl" aria-hidden="true" />
        <span className="masthead__tape masthead__tape--tr" aria-hidden="true" />

        <div className="masthead__brand">
          <span className="masthead__sun" aria-hidden="true">
            <span className="ray" />
            <span className="ray" />
            <span className="ray" />
            <span className="ray" />
            <span className="ray" />
            <span className="ray" />
            <span className="core" />
          </span>
          <div className="masthead__brandtext">
            <span className="masthead__name">Frame in Goa</span>
            <small>HH Goa 2026 &middot; Builder ID</small>
          </div>
        </div>

        <div className="masthead__meta">
          <span>Goa &middot; India</span>
          <i className="masthead__sep" aria-hidden="true" />
          <span>28&ndash;31 Oct 2026</span>
          <i className="masthead__sep" aria-hidden="true" />
          <span className="masthead__hand">beach + builders + sun</span>
        </div>

        <div className="masthead__action">
          <span className="masthead__hash">#FrameInGoa</span>
          <a
            className="masthead__cta"
            href={APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apply Now &#8594;
          </a>
        </div>
      </div>
    </header>
  );
}

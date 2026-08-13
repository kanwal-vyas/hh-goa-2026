import './Hero.css';

interface HeroProps {
  onScrollToCompose: () => void;
  onScrollToHow: () => void;
}

export function Hero({ onScrollToCompose, onScrollToHow }: HeroProps) {
  return (
    <div className="hero-inner">
      {/* print-language SVG filter: turns the GOA block into rough applied ink */}
      <svg className="hero-defs" aria-hidden="true" focusable="false">
        <filter id="ink-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06 0.09"
            numOctaves="3"
            seed="4"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <div className="eyebrow">
        <span className="pulse" />
        Open now &middot; 247 builders &middot; Private beach, Goa
      </div>

      <h1 className="hero-title">
        BUILDER
        <span className="accent-line">
          ID FOR{' '}
          <span className="goa-chip">
            {/* rough applied pigment — the ink is displaced, the letters stay crisp */}
            <span className="goa-chip__ink" aria-hidden="true" />
            GOA
            {/* the annotation hugs the block it points at */}
            <svg className="goa-arrow" viewBox="0 0 140 120" aria-hidden="true">
              <path className="arrow-body" d="M 16 104 C 52 78, 84 52, 108 22" />
              <path className="arrow-head" d="M 104 14 L 122 12 L 112 30 Z" />
            </svg>
          </span>
        </span>
      </h1>

      {/* one hand-painted underline — a single brush, not a double rule */}
      <div className="hero-underline" aria-hidden="true">
        <svg viewBox="0 0 640 44" preserveAspectRatio="none">
          <path className="under-wide" d="M 18 20 C 130 8, 260 30, 410 18 S 560 12, 620 16" />
          <path className="under-thin" d="M 30 30 C 170 22, 320 40, 480 30 S 590 24, 622 28" />
        </svg>
      </div>

      <p className="hero-sub">
        Drop your photo. Tell us what you build. Watch the{' '}
        <b>environment settle</b> into your own collectible summer poster —
        then post it with #FrameInGoa.
      </p>

      <div className="hero-actions">
        <button className="btn-primary" onClick={onScrollToCompose}>
          Create Your Frame &#8594;
        </button>
        <a className="hand-tag" href="#how-to-frame" onClick={(e) => { e.preventDefault(); onScrollToHow(); }}>
          it's basically <span>sunlight you can build</span>
        </a>
      </div>
    </div>
  );
}

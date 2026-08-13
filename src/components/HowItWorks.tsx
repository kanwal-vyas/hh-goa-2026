import './HowItWorks.css';
import crabUrl from '../assets/crab.png';

interface HowItWorksProps {
  onScrollToCompose: () => void;
}

const STEPS = [
  {
    n: '01',
    title: 'Show your face',
    note: 'your face, please',
    body: 'Drop in a photo. Portrait, landscape, or whatever you have — we’ll handle the composition.',
  },
  {
    n: '02',
    title: 'Tell us what you build',
    note: 'brag a little',
    body: 'Add your name and stack / role. We’ll turn it into your Builder identity.',
  },
  {
    n: '03',
    title: 'Get your Builder ID',
    note: 'wear it proudly',
    body: 'Preview the generated composition, download it, and share it with #FrameInGoa.',
  },
];

/**
 * HOW IT WORKS — an editorial instruction panel in the festival-poster
 * language: giant Bodoni numerals, thin stitched rules, Caveat hand notes
 * and tape at the corners. Deliberately not a SaaS feature grid.
 */
export function HowItWorks({ onScrollToCompose }: HowItWorksProps) {
  return (
    <section id="how-to-frame" className="how-stage" aria-label="How to frame your Goa">
      {/* a few tiny crabs scuttling across the sand — atmosphere, not content */}
      <img className="crab crab--1" src={crabUrl} alt="" draggable={false} />
      <img className="crab crab--2" src={crabUrl} alt="" draggable={false} />
      <img className="crab crab--3" src={crabUrl} alt="" draggable={false} />

      <div className="how-panel">
        <span className="how-tape how-tape--tl" aria-hidden="true" />
        <span className="how-tape how-tape--br" aria-hidden="true" />

        <header className="how-head">
          <span className="how-kicker">How it works</span>
          <h2 className="how-title">How to frame your Goa</h2>
          <span className="how-hand">three easy moves ✦</span>
        </header>

        <ol className="how-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="how-step">
              <span className="how-num" aria-hidden="true">
                {s.n}
              </span>
              <div className="how-copy">
                <h3 className="how-step-title">{s.title}</h3>
                <p className="how-step-body">{s.body}</p>
              </div>
              <span className="how-note">{s.note}</span>
            </li>
          ))}
        </ol>

        <footer className="how-foot">
          <button type="button" className="how-cta" onClick={onScrollToCompose}>
            start framing <span aria-hidden="true">↓</span>
          </button>
        </footer>
      </div>
    </section>
  );
}

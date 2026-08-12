import type { Identity } from '../identity/types';
import './GeneratingPanel.css';

interface GeneratingPanelProps {
  identity: Identity;
  photoUrl: string | null;
}

/**
 * The GENERATING moment — a ~2s, CSS-only choreography of the environment
 * physically assembling the builder's identity. No per-frame React, no
 * second animation loop: pure keyframes on a paper sheet that drops in, the
 * photo that lands, the type that rises, and a stamp that impacts at the
 * end. The actual poster artwork is rendered once and revealed after.
 */
export function GeneratingPanel({ identity, photoUrl }: GeneratingPanelProps) {
  const first = identity.layout.name.split(/\s+/)[0] ?? '';
  return (
    <div className="gen-overlay" role="status" aria-live="polite">
      <div className="gen-sheet">
        <div className="gen-head">
          <span>Hacker House Goa 2026</span>
          <span>Builder ID #{identity.idNumber}</span>
        </div>

        <div className="gen-photo">
          <span className="gen-photo__mat" aria-hidden="true" />
          <span className="gen-photo__tape gen-photo__tape--tl" aria-hidden="true" />
          <span className="gen-photo__tape gen-photo__tape--br" aria-hidden="true" />
          {photoUrl ? (
            <img src={photoUrl} alt="" />
          ) : (
            <span className="gen-photo__empty">YOUR FACE HERE</span>
          )}
        </div>

        <div className="gen-name">{identity.layout.name}</div>
        <div className="gen-role">{identity.layout.role}</div>

        <div className="gen-waves" aria-hidden="true">
          <span className="w1" />
          <span className="w2" />
          <span className="w3" />
          <span className="foam" />
        </div>

        <div className="gen-stamp" aria-hidden="true">
          LOCKED
        </div>
      </div>

      <div className="gen-status">
        <span className="gen-status__step gen-status__step--1">
          the environment is assembling your identity{first ? `, ${first}` : ''}…
        </span>
        <span className="gen-status__step gen-status__step--2">locking the print.</span>
      </div>
    </div>
  );
}

import { useEffect, useReducer, useRef, useState } from 'react';
import { LiveBackground } from './LiveBackground';
import { Header } from './Header';
import { Hero } from './Hero';
import { PhotoUpload } from './PhotoUpload';
import { GeneratingPanel } from './GeneratingPanel';
import { BuilderPoster } from './BuilderPoster';
import {
  experienceReducer,
  initialExperienceState,
} from '../state/experienceState';
import { generateIdentity } from '../identity/generate';
import type { Identity } from '../identity/types';
import './Experience.css';

/**
 * The end-to-end experience. React owns the coarse state machine and the
 * UI; the environment is one canvas driven by LiveEnvironment; the Builder
 * ID poster is a deterministic seeded composition rendered to its own
 * canvas by the identity/ pipeline.
 */
export function Experience() {
  const [state, dispatch] = useReducer(experienceReducer, initialExperienceState);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [pending, setPending] = useState<Identity | null>(null);
  const composeRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number>(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    return () => window.clearTimeout(timerRef.current);
  }, []);

  // The generation reveal lands at the top of the page.
  useEffect(() => {
    if (state.stage === 'GENERATING' || state.stage === 'GENERATED') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.stage]);

  const handlePhotoSelect = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    dispatch({ type: 'PHOTO_SELECTED', file, objectUrl });
  };

  const startGeneration = (roll: number) => {
    const details = {
      name: name || 'A. Builder',
      role: role || 'Full-Stack Engineer',
      stack: 'Frontend',
    };
    dispatch({ type: 'DETAILS_SUBMITTED', details });
    dispatch({ type: 'GENERATE_START' });

    const photoMeta = state.photo
      ? `${state.photo.file.name}:${state.photo.file.size}:${state.photo.file.lastModified}`
      : null;
    const identity = generateIdentity({
      name: details.name,
      role: details.role,
      photoMeta,
      roll,
    });
    setPending(identity);

    window.clearTimeout(timerRef.current);
    const duration = reducedMotion ? 120 : 2300;
    timerRef.current = window.setTimeout(() => {
      dispatch({ type: 'GENERATE_COMPLETE', identity });
    }, duration);
  };

  const handleGenerate = () => startGeneration(state.roll);

  const handleReRoll = () => {
    dispatch({ type: 'RE_ROLL' });
    startGeneration(state.roll + 1);
  };

  const handleEdit = () => dispatch({ type: 'EDIT' });

  return (
    <>
      <Header />

      <div className="stage-backdrop">
        <LiveBackground stage={state.stage} seed={state.seed} />

        <section className="hero-stage">
          <Hero onScrollToCompose={() => composeRef.current?.scrollIntoView({ behavior: 'smooth' })} />
        </section>

        {state.stage === 'GENERATED' && state.identity ? (
          <BuilderPoster
            identity={state.identity}
            photoUrl={state.photo?.objectUrl ?? null}
            onReRoll={handleReRoll}
            onEdit={handleEdit}
          />
        ) : (
          <section className="compose-stage" ref={composeRef}>
            <div className="compose-inner">
              <div className="compose-head">
                <div className="eyebrow">
                  <span className="pulse" />
                  Show your face &middot; what do you build
                </div>
                <h2>Feed the environment, it does the rest.</h2>
                <p>
                  Your photo, name and stack shape the final composition.
                  Everything you enter here nudges the background from loose
                  and alive toward locked and structured.
                </p>
              </div>

              <div className="compose-grid">
                <PhotoUpload objectUrl={state.photo?.objectUrl ?? null} onSelect={handlePhotoSelect} />

                <div className="compose-fields">
                  <label className="field">
                    <span>Your name</span>
                    <input
                      type="text"
                      placeholder="e.g. Kavya Verma"
                      maxLength={26}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>What do you build</span>
                    <input
                      type="text"
                      placeholder="e.g. full-stack engineer"
                      maxLength={30}
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </label>

                  <div className="generate-row">
                    <button
                      className="btn-generate"
                      onClick={handleGenerate}
                      disabled={state.stage === 'GENERATING'}
                    >
                      {state.stage === 'GENERATING' ? 'Settling in…' : 'Lock My Builder ID ✦'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {state.stage === 'GENERATING' && pending && (
        <GeneratingPanel identity={pending} photoUrl={state.photo?.objectUrl ?? null} />
      )}
    </>
  );
}

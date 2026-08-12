/**
 * The experience state machine.
 *
 * This is intentionally coarse. React owns *this* state and re-renders on
 * it — but nothing here changes more than a few times per session, so it
 * never drives per-frame animation. The live graphics read a "stage" and
 * settle toward it on their own clock (see graphics/LiveEnvironment.ts).
 *
 * GENERATE_COMPLETE carries the full deterministic Identity (seed, variant,
 * builder number, poster layout) — the artwork itself is rendered to canvas
 * by the identity/ pipeline, never as React DOM.
 */

import type { Identity } from '../identity/types';

export type Stage =
  | 'INTRO'
  | 'PHOTO_UPLOADED'
  | 'DETAILS_ENTERED'
  | 'GENERATING'
  | 'GENERATED';

export interface BuilderDetails {
  name: string;
  role: string;
  stack: string;
}

export interface ExperienceState {
  stage: Stage;
  photo: { file: File; objectUrl: string } | null;
  details: BuilderDetails | null;
  seed: string | null;
  identity: Identity | null;
  roll: number;
}

export type ExperienceAction =
  | { type: 'PHOTO_SELECTED'; file: File; objectUrl: string }
  | { type: 'PHOTO_CLEARED' }
  | { type: 'DETAILS_SUBMITTED'; details: BuilderDetails }
  | { type: 'GENERATE_START' }
  | { type: 'GENERATE_COMPLETE'; identity: Identity }
  | { type: 'RE_ROLL' }
  | { type: 'EDIT' }
  | { type: 'RESET' };

export const initialExperienceState: ExperienceState = {
  stage: 'INTRO',
  photo: null,
  details: null,
  seed: null,
  identity: null,
  roll: 0,
};

export function experienceReducer(
  state: ExperienceState,
  action: ExperienceAction
): ExperienceState {
  switch (action.type) {
    case 'PHOTO_SELECTED':
      return {
        ...state,
        photo: { file: action.file, objectUrl: action.objectUrl },
        stage: state.stage === 'INTRO' ? 'PHOTO_UPLOADED' : state.stage,
      };

    case 'PHOTO_CLEARED':
      return { ...state, photo: null };

    case 'DETAILS_SUBMITTED':
      return { ...state, details: action.details, stage: 'DETAILS_ENTERED' };

    case 'GENERATE_START':
      return { ...state, stage: 'GENERATING' };

    case 'GENERATE_COMPLETE':
      return {
        ...state,
        stage: 'GENERATED',
        identity: action.identity,
        seed: action.identity.seed,
      };

    case 'RE_ROLL':
      return { ...state, stage: 'GENERATING', roll: state.roll + 1 };

    case 'EDIT':
      return { ...state, stage: 'DETAILS_ENTERED' };

    case 'RESET':
      return initialExperienceState;

    default:
      return state;
  }
}

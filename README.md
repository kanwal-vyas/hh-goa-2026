# hh-goa-2026 · Frame in Goa

A collectible, editorial Goa summer poster generator for Hacker House Goa 2026 (28–31 Oct, Goa, India).

Drop your photo, tell us what you build, and the environment assembles your own deterministic **Builder ID** — a taped-photo summer poster you can download and post with **#FrameInGoa**.

## Features

- **Live canvas environment** — one `requestAnimationFrame` loop driving a continuous tropical scene (ocean, sunlight, palm shadows) that reacts to the experience state machine (`INTRO → PHOTO_UPLOADED → DETAILS_ENTERED → GENERATING → GENERATED`).
- **Deterministic Builder ID generation** — the same photo + name + role always produce the same poster. A seeded PRNG (FNV-1a + mulberry32) picks the variant, builder number, palette accent, and every layout detail. No `Math.random` in the composition path.
- **Four composition families** — portrait & type, editorial offset, type-behind-photo, and a ticket/pass — all within one Frame-in-Goa identity.
- **True print materiality** — cream paper with grain and vignette, a taped photograph on an irregular paper mat, screen-print sun, printed layered waves, palm silhouettes, ink stamps, hand-drawn marks, registration marks.
- **High-resolution export** — the poster renders in a fixed 1080×1350 design space and downloads as a 2160×2700 PNG (the real composition, not a screenshot).
- **~2s assembly moment** — a CSS-only choreography: the paper sheet drops, the photo lands, type rises, and a LOCKED stamp impacts.
- Reduced-motion aware, responsive, no extra dependencies (React + TypeScript + Vite only).

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run lint     # oxlint
```

## Stack

React 19 · TypeScript · Vite · Canvas 2D · zero additional runtime dependencies.

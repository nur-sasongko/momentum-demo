# PWA Architecture

This project supports Progressive Web App (PWA) installability and offline caching on top of a static Vite SPA build (see `docs/specs/004-core-remove-ssr.md`).

Related architecture docs:

- `docs/architecture/feature-slices.md` for slice layout and code organization
- `docs/architecture/testing.md` for test runner setup, file placement, and coverage
- `docs/architecture/commit-workflow.md` for Husky hooks, staged checks, and commit message format

## Why this setup exists

`vite-plugin-pwa`'s own `generateSW` output isn't used directly for the service worker itself — this project uses a split approach so the service worker source stays a plain, readable TypeScript file (`src/sw.ts`) instead of `vite-plugin-pwa`'s generated Workbox config:

- `vite-plugin-pwa` for manifest generation
- a post-build Workbox step for service worker output

## Build and runtime flow

1. `vite build` generates a flat static `dist/` bundle and `manifest.webmanifest`.
2. `bun run generate-sw` runs `scripts/generate-sw.ts`.
3. `scripts/generate-sw.ts` compiles `src/sw.ts` and injects precache assets.
4. `dist/sw.js` is produced for browser registration.

`generate-sw.ts`'s `globPatterns` (`js,css,ico,png,svg,woff2,ttf,webmanifest`)
decides what's in the precache — anything not listed is missing offline on a cold
cache. `ttf` was added for `public/fonts/pdf/` (Second Brain's PDF export — see
[`docs/second-brain.md`](../second-brain.md#export)): those fonts are fetched by
URL at export time rather than bundled into JS, so without this glob, exporting a
PDF while offline would silently fall back to standard-14 fonts instead of the
app's own Inter/IBM Plex Mono.

## Source of truth

- PWA plugin config: `vite.config.ts`
- Service worker source: `src/sw.ts`
- Service worker generator: `scripts/generate-sw.ts`
- Root document head tags (`manifest`, `theme-color`, `apple-touch-icon`): `index.html`

## Caching strategy

- **Navigation requests**: `NetworkFirst` (`pages-cache`)
- **Static resources** (`style`, `script`, `worker`): `CacheFirst` (`static-resources`)
- **Images**: `CacheFirst` (`images-cache`)

This balances freshness for navigations with fast repeated loads for static assets.

## Required commands

- Dev server: `bun --bun run dev`
- Production build with SW generation: `bun --bun run build`
- Local production preview: `bun --bun run preview`

Always verify PWA behavior against a production build, not dev server only.

## Installability checklist

Use browser DevTools (`Application` tab):

1. Manifest is loaded and valid.
2. Service worker is registered and active.
3. `sw.js` is served successfully.
4. Site is on secure origin (`https`) or `localhost`.

If install button does not appear, inspect Manifest installability diagnostics first.

## Maintenance notes

- Keep manifest metadata in `vite.config.ts` aligned with product name/theme.
- Icon master art is `public/icon.svg` (also served as the SVG favicon). The PNG derivatives (`logo192.png`, `logo512.png`, `maskable512.png`, `apple-touch-icon.png`) and `favicon.ico` are rendered from it — regenerate all of them together when the mark changes. `maskable512.png` keeps the mark inside the ~80% safe zone on a full-bleed background; `apple-touch-icon.png` is full-bleed square (iOS applies its own corner mask).
- If changing build output behavior, re-check that `dist/sw.js` is still created.

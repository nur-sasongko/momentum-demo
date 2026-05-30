# PWA Architecture

This project supports Progressive Web App (PWA) installability and offline caching on top of TanStack Start SSR.

Related architecture docs:

- `docs/architecture/feature-slices.md` for slice layout and code organization
- `docs/architecture/testing.md` for test runner setup, file placement, and coverage
- `docs/architecture/commit-workflow.md` for Husky hooks, staged checks, and commit message format

## Why this setup exists

TanStack Start uses SSR build behavior that does not reliably emit `sw.js` from `vite-plugin-pwa` alone in this repository.  
To keep installability and offline support working, this project uses a split approach:

- `vite-plugin-pwa` for manifest generation
- a post-build Workbox step for service worker output

## Build and runtime flow

1. `vite build` generates client/server bundles and `manifest.webmanifest`.
2. `bun run generate-sw` runs `scripts/generate-sw.ts`.
3. `scripts/generate-sw.ts` compiles `src/sw.ts` and injects precache assets.
4. `dist/client/sw.js` is produced for browser registration.

## Source of truth

- PWA plugin config: `vite.config.ts`
- Service worker source: `src/sw.ts`
- Service worker generator: `scripts/generate-sw.ts`
- Root document head tags (`manifest`, `theme-color`, `apple-touch-icon`): `src/routes/__root.tsx`

## Caching strategy

- **Navigation requests**: `NetworkFirst` (`pages-cache`)
- **Static resources** (`style`, `script`, `worker`): `CacheFirst` (`static-resources`)
- **Images**: `CacheFirst` (`images-cache`)

This balances freshness for SSR pages with fast repeated loads for static assets.

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
- Replace starter icons (`logo192.png`, `logo512.png`) before release.
- If changing build output behavior, re-check that `dist/client/sw.js` is still created.

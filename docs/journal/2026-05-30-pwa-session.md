# Session Journal: PWA Setup + Router Warning Fix

## Date

- 2026-05-30

## Goal

- Make the app installable as a PWA.
- Resolve runtime warning seen in dev terminal for TanStack Router root route.

## What Was Implemented

### 1) PWA foundation

- Added `vite-plugin-pwa`.
- Configured `VitePWA()` in [`vite.config.ts`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/vite.config.ts) with:
  - `registerType: 'autoUpdate'`
  - manifest metadata (`name`, `short_name`, `theme_color`, `background_color`)
  - app icons and maskable icon entry
  - `devOptions.enabled: false`
- Added PWA head tags in [`src/routes/__root.tsx`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/src/routes/__root.tsx):
  - manifest link
  - theme-color meta
  - apple-touch-icon
- Removed old static manifest file:
  - deleted [`public/manifest.json`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/public/manifest.json)

### 2) TanStack Start service worker workaround

`vite-plugin-pwa` generated `manifest.webmanifest` but did not emit `sw.js` in this TanStack Start setup.  
To ensure SW generation:

- Added Workbox-based SW source:
  - [`src/sw.ts`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/src/sw.ts)
- Added post-build generator:
  - [`scripts/generate-sw.ts`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/scripts/generate-sw.ts)
- Updated build pipeline in [`package.json`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/package.json):
  - `build` now runs `vite build && bun run generate-sw`
  - added `generate-sw` script
- Added Workbox dependencies:
  - `workbox-build`
  - `workbox-precaching`
  - `workbox-routing`
  - `workbox-strategies`
  - `workbox-expiration`

### 3) Router warning fix

Resolved warning:

- `notFoundError encountered on route "__root__" ... notFoundComponent not configured`

Fix:

- Added `notFoundComponent` to root route in [`src/routes/__root.tsx`](/Users/nursasongko/Documents/projects/node/personal-project/sasongko-app/src/routes/__root.tsx)
- Implemented `RootNotFoundComponent` with a link back to `/`

## Verification Performed

- Production build succeeded multiple times:
  - `bun --bun run build`
- SW generation succeeded:
  - `Service worker generated with 8 files...`
- Confirmed `dist/client/sw.js` exists.
- Lint checks on edited files reported no issues.

## Known Follow-up

Install button may still not appear immediately in browser URL bar if installability criteria are not fully met at runtime.  
Likely checks for future agents:

- Confirm service worker is registered and active in browser DevTools.
- Verify `/sw.js` is served at runtime.
- Test installability on production preview (`build + preview`) rather than dev only.
- Optionally add explicit runtime registration UI/logic if needed.

## Notes For Future AI Agents

- This repo uses TanStack Start SSR; PWA behavior differs from SPA defaults.
- `vite-plugin-pwa` manifest generation works, but SW generation required a post-build script in this session.
- If install prompt is missing, inspect:
  - DevTools -> Application -> Manifest (Installability)
  - DevTools -> Application -> Service Workers
- PWA icons are still starter assets (`logo192.png`, `logo512.png`); replace for production branding.

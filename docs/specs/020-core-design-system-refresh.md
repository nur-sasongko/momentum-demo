---
id: 20
title: 'Design System Refresh: Warm Light, Readable Dark, Semantic Tokens'
status: in-progress
feature: core
related-features: [finance, notes]
created: 2026-08-11
updated: 2026-08-13
---

# Design System Refresh: Warm Light, Readable Dark, Semantic Tokens

## Problem Statement

Dark mode — which is the app's default theme (`getStoredTheme()` returns `'dark'`) — is painful to read for any sustained session. `--background` is `oklch(0.07 0 0)`, which resolves to `#010101`: effectively pure black. Against `--foreground` at `#eeeeee` that is a **17.9:1** contrast ratio, roughly four times the WCAG AA threshold, and at that ratio light glyphs bloom and smear against the dark field. `--card` at `oklch(0.09 0 0)` resolves to `#020202` — one value out of 255 lighter than the background — so the surface ladder does not visually exist and every card edge is carried by its border alone. `--secondary` and `--muted` are both `oklch(0.14 0 0)`, the same token declared twice.

Light mode has the opposite problem: every neutral is declared at chroma `0`, so the entire surface is pure achromatic grey with nothing to soften the glare of a bright screen.

Separately, the token system has gaps that force feature code to invent its own colors. There is no success, warning, income, expense, or favorite token, so 20 hardcoded Tailwind literals (`text-emerald-600`, `text-rose-400`, `text-amber-500`, …) are scattered across 13 sites in 10 files, none of which respond to a theme change in a coordinated way. `font-mono` is used by the notes code blocks but no `--font-mono` is declared, so it silently falls back to whatever the OS provides. Inter is loaded through a CSS `@import` to the Google Fonts CDN, which is both the slowest possible load path and invisible to the service worker's precache glob (`**/*.{js,css,ico,png,svg,woff2,webmanifest}`) — so the installed PWA renders in a fallback font whenever it is offline. And numeric values, which are the substance of a tracker, carry no tabular-figure rule outside `stat-block.tsx`, so digits shift width between rows in the transactions table.

## Goals

- Lift dark mode off pure black onto a three-step surface ladder with text contrast in a comfortable range rather than a maximal one.
- Introduce warmth to light-mode neutrals so the surface reads as paper rather than as a lit panel.
- Close the semantic token gaps (success, warning, income, expense, favorite) and migrate every hardcoded Tailwind color literal onto them.
- Give quantities their own typographic voice: a dedicated numeric face with true tabular figures, applied wherever a number appears.
- Self-host fonts so the installed PWA renders correctly offline.
- Keep every color decision verifiable — each value in this spec has a computed contrast ratio, and the chart palette passes the `dataviz` validator.
- _(added 2026-08-13)_ Make hover and selected states belong to the surface they sit on, and make them distinguishable from each other.

## Non-Goals

- **No page-level layout redesigns.** The finance and notes routes keep their current structure, component composition, and information architecture. They change only by consuming the new tokens.
- **No component API changes.** Shadcn primitives in `src/components/ui/` keep their props and variants.
- **No new features, routes, or data.** No store changes, no query changes, no schema changes.
- **Habits and tasks are not migrated in this spec** beyond what they inherit for free from the global tokens.
- **Not changing `--radius`** (stays `0.625rem`) or the sidebar/topbar structural layout.

## Design Decisions

### Two materials, not one inverted theme

Light mode warms toward paper (neutral hue anchor **75–85**, chroma `0.004`–`0.014`). Dark mode cools toward ink (neutral hue anchor **275**, chroma `0.008`–`0.014`).

This is deliberate rather than symmetrical. Warmth in light mode reduces the glare of a large bright surface. Applying the same warmth to dark mode makes the surfaces read as muddy brown and drags the violet accent toward grey. Splitting the temperature also gives the two themes distinct identities instead of one being the photographic negative of the other.

The brand hue stays violet at **285** (a 5° warm shift from the current 280, which seats it better against warm neutrals). In dark mode its chroma drops from `0.20` to `0.13` — high chroma on a near-black field is the third source of the current eye strain.

### The signature: numbers get their own voice

Momentum is an instrument — balances, expenses, streaks, timestamps, tag counts. Those quantities currently render in the same Inter as body prose, so data and chrome are typographically indistinguishable.

**IBM Plex Mono** becomes `--font-numeric`, applied system-wide to every quantity, and simultaneously fills the missing `--font-mono` role for code blocks. One family, two roles, one font payload — it is a humanist mono with genuinely characterful figures (flat-topped `1`, open `4`), so it reads as a considered readout rather than as generic code. Body copy, labels, and headings stay in Inter; the contrast between the two is what makes data legible at a glance.

### Interaction states are made of the field, not painted onto it

_Added 2026-08-13, after reviewing the shipped light sidebar._

The first implementation of this spec inherited Shadcn's default assumption that a hovered or selected row is a **tint** — a wash of the brand hue laid over whatever surface it lands on. That assumption is safe only when the surface is achromatic. It is not safe here, because the whole point of "two materials, not one inverted theme" is that light-mode surfaces are warm. Measured against the shipped tokens:

|                                           | value                    | hex       |
| ----------------------------------------- | ------------------------ | --------- |
| `--sidebar`                               | `oklch(0.962 0.008 82)`  | `#f5f2ed` |
| `--sidebar-accent` (hover **and** active) | `oklch(0.955 0.018 285)` | `#eeeffc` |

The active chip is **1.02:1** against its own field — no lightness separation at all — while sitting **203° away in hue** at more than double the chroma. Every bit of the shape is carried by hue. That is precisely the signature of a decal: the eye reads two different materials touching, rather than one material in two states. It is also why the defect is invisible in dark mode, where field (hue 275) and accent (hue 285) are 10° apart and the same wash reads as a normal highlight.

Two rules follow, and they generalize past the sidebar:

1. **A state is a step in the surface ladder, not a hue.** Hover and active move along L within the field's own hue. Brand color moves to the **foreground** — icon and label in `--primary` — where chroma is legible against a light background instead of competing with it.
2. **Hover and selected must be different tokens.** `sidebar.tsx:395` currently maps `hover:`, `active:`, and `data-[active=true]:` all to `bg-sidebar-accent`, so pointing at one item makes it indistinguishable from the selected one. Selection is persistent state and hover is transient feedback; they cannot share a value.

Direction of the step is per-theme, following the elevation rule already established above (light elevates with shadow, dark elevates with lightness):

- **Light** — selected item _rises_ to `--card` (`#fffdfa`) with a `shadow-xs` and a `--sidebar-border` hairline; hover _sinks_ to the warm muted step (`#efece7`). Rise and sink read as different gestures, so the two states never collide.
- **Dark** — shadow does not exist as a cue, so both states rise: hover to `#1a1b20`, selected to `#25272c`, which is a 1.27:1 step off the sidebar and lands on the existing `--secondary` value.

The same defect exists in the global `--accent` (`#eeeffc` on the warm `--popover` `#fffefc`), which is the hover/focus wash for dropdown items, select items, table rows, and the command palette — 29 occurrences across 16 files. It is fixed the same way: `--accent` becomes the warm neutral step, and the brand hue stays in text and rings.

**This does not remove violet from the UI.** It relocates it. `--primary`, `--ring`, `--chart-1`, links, and solid brand fills are unchanged; what goes away is violet used as a _background wash on a warm surface_, which is the only place it was fighting the material.

## Token Specification

All values below are computed, not estimated. Contrast ratios are WCAG 2.x against the stated surface.

### Light — "warm paper"

| Token                    | Value                   | Hex       | Note                                          |
| ------------------------ | ----------------------- | --------- | --------------------------------------------- |
| `--background`           | `oklch(0.978 0.006 85)` | `#faf7f3` |                                               |
| `--foreground`           | `oklch(0.24 0.012 75)`  | `#231f19` | 15.45:1 on bg                                 |
| `--card`                 | `oklch(0.995 0.004 85)` | `#fffdfa` | raised above bg                               |
| `--card-foreground`      | `oklch(0.24 0.012 75)`  | `#231f19` | 16.23:1 on card                               |
| `--popover`              | `oklch(0.998 0.003 85)` | `#fffefc` |                                               |
| `--popover-foreground`   | `oklch(0.24 0.012 75)`  | `#231f19` |                                               |
| `--muted`                | `oklch(0.945 0.008 82)` | `#efece7` | sunken                                        |
| `--muted-foreground`     | `oklch(0.505 0.014 75)` | `#69645c` | 5.80:1 on card                                |
| `--secondary`            | `oklch(0.955 0.008 82)` | `#f3f0ea` | now distinct from muted                       |
| `--secondary-foreground` | `oklch(0.28 0.012 75)`  |           |                                               |
| `--accent`               | `oklch(0.945 0.008 82)` | `#efece7` | **revised** — warm step, was `#eeeffc` violet |
| `--accent-foreground`    | `oklch(0.28 0.012 75)`  | `#2c2822` | **revised** — 12.43:1 on accent               |
| `--border`               | `oklch(0.895 0.009 80)` | `#dfdcd6` | dividers                                      |
| `--input`                | `oklch(0.64 0.014 80)`  | `#918b83` | **3.32:1** — interactive boundary             |
| `--ring`                 | `oklch(0.52 0.17 285)`  | `#6353c5` | 5.79:1 on card                                |
| `--primary`              | `oklch(0.52 0.17 285)`  | `#6353c5` | 5.51:1 on bg                                  |
| `--primary-foreground`   | `oklch(0.99 0.005 85)`  | `#fdfcf8` | 5.70:1 on primary                             |
| `--sidebar`              | `oklch(0.962 0.008 82)` | `#f5f2ed` |                                               |

### Dark — "deep ink"

| Token                    | Value                    | Hex       | Note                              |
| ------------------------ | ------------------------ | --------- | --------------------------------- |
| `--background`           | `oklch(0.19 0.008 275)`  | `#131417` | was `#010101`                     |
| `--foreground`           | `oklch(0.905 0.006 85)`  | `#e1dfdb` | 13.92:1 on bg                     |
| `--card`                 | `oklch(0.228 0.009 275)` | `#1b1c21` | **visibly** raised                |
| `--card-foreground`      | `oklch(0.905 0.006 85)`  | `#e1dfdb` | 12.80:1 on card (was 17.89:1)     |
| `--popover`              | `oklch(0.262 0.010 275)` | `#232429` | third step                        |
| `--popover-foreground`   | `oklch(0.905 0.006 85)`  | `#e1dfdb` |                                   |
| `--muted`                | `oklch(0.255 0.009 275)` | `#212327` |                                   |
| `--muted-foreground`     | `oklch(0.695 0.010 278)` | `#9b9ca3` | 6.23:1 on card (was 4.87:1)       |
| `--secondary`            | `oklch(0.272 0.010 275)` | `#25272c` | no longer identical to muted      |
| `--secondary-foreground` | `oklch(0.88 0.006 85)`   |           |                                   |
| `--accent`               | `oklch(0.285 0.010 275)` | `#282a2f` | **revised** — chroma to neutral   |
| `--accent-foreground`    | `oklch(0.905 0.006 85)`  | `#e1dfdb` | **revised**                       |
| `--border`               | `oklch(0.325 0.011 275)` | `#32343a` | dividers                          |
| `--input`                | `oklch(0.54 0.014 275)`  | `#6c6e77` | **3.35:1** — interactive boundary |
| `--ring`                 | `oklch(0.75 0.15 285)`   | `#a59eff` | 7.25:1 on card                    |
| `--primary`              | `oklch(0.72 0.13 285)`   | `#9d98f2` | 6.63:1 on card                    |
| `--primary-foreground`   | `oklch(0.17 0.02 285)`   | `#0e0e18` | **must flip to ink** — see below  |
| `--sidebar`              | `oklch(0.172 0.008 275)` | `#0f1013` | recedes behind content            |

### Sidebar interaction states (revised 2026-08-13)

Shadcn ships four sidebar state tokens and expects hover and selected to share `--sidebar-accent`. Selected needs its own pair, so two tokens are added: `--sidebar-active` and `--sidebar-active-foreground`, registered in `@theme inline` as `--color-sidebar-active` / `--color-sidebar-active-foreground`.

**Light**

| Token                         | Value                   | Hex       | Note                                     |
| ----------------------------- | ----------------------- | --------- | ---------------------------------------- |
| `--sidebar`                   | `oklch(0.962 0.008 82)` | `#f5f2ed` | unchanged — the field                    |
| `--sidebar-accent` (hover)    | `oklch(0.945 0.008 82)` | `#efece7` | **revised** — sinks; 1.06:1 off field    |
| `--sidebar-accent-foreground` | `oklch(0.28 0.012 75)`  | `#2c2822` | **revised** — 12.43:1 on hover           |
| `--sidebar-active` (selected) | `oklch(0.995 0.004 85)` | `#fffdfa` | **new** — rises; 1.10:1 off field        |
| `--sidebar-active-foreground` | `oklch(0.52 0.17 285)`  | `#6353c5` | **new** — brand; 5.79:1 on the chip      |
| `--sidebar-border` (hairline) | `oklch(0.895 0.009 80)` | `#dfdcd6` | unchanged — 1.35:1, edges the risen chip |

**Dark**

| Token                         | Value                    | Hex       | Note                                  |
| ----------------------------- | ------------------------ | --------- | ------------------------------------- |
| `--sidebar`                   | `oklch(0.172 0.008 275)` | `#0f1013` | unchanged — the field                 |
| `--sidebar-accent` (hover)    | `oklch(0.225 0.009 275)` | `#1a1b20` | **revised** — rises; 1.11:1 off field |
| `--sidebar-accent-foreground` | `oklch(0.88 0.006 85)`   | `#d9d7d3` | **revised** — 11.96:1 on hover        |
| `--sidebar-active`            | `oklch(0.272 0.010 275)` | `#25272c` | **new** — 1.27:1 off field            |
| `--sidebar-active-foreground` | `oklch(0.72 0.13 285)`   | `#9d98f2` | **new** — brand; 5.84:1 on the chip   |

The selected chip carries `font-medium` (already present) and tints its icon along with its label, since `[&>svg]` inherits `currentColor`. Light mode adds `shadow-xs` and the hairline; dark mode adds neither — `dark:shadow-none`, per the elevation rule.

Both `--sidebar-active-foreground` values are just `--primary`. They are still declared as their own tokens rather than aliased inline, so a future sidebar-specific brand shift has a seam to change.

> **`--primary-foreground` in dark mode is currently a latent bug.** It is declared as `oklch(0.98 0 0)` — near-white text on the violet primary. Against the new `#9d98f2` that is **2.42:1**, a clear AA failure for button labels; even against today's `#7673fd` it is marginal. It must become dark ink (`#0e0e18`, **7.48:1**). This affects every `variant="default"` Button, `SidebarMenuButton` in its active state, and the active tag chips in `note-list.tsx`.

### Semantic tokens (new)

`--money-out` is deliberately **not** `--destructive`. An expense is a normal event, not an error; a large expense figure rendered in error-red reads as a system failure. Money-out sits at hue 32 (a warmer terracotta) while destructive stays at hue 25 (a true alarm red).

| Token           | Light                            | Ratio  | Dark                             | Ratio  |
| --------------- | -------------------------------- | ------ | -------------------------------- | ------ |
| `--destructive` | `oklch(0.52 0.19 25)` `#be222a`  | 6.00:1 | `oklch(0.68 0.17 25)` `#ef6661`  | 5.46:1 |
| `--success`     | `oklch(0.52 0.13 150)` `#1d7d3e` | 5.12:1 | `oklch(0.76 0.13 152)` `#6bc987` | 8.33:1 |
| `--warning`     | `oklch(0.55 0.12 70)` `#9d6300`  | 4.91:1 | `oklch(0.78 0.12 75)` `#e4ac59`  | 8.36:1 |
| `--money-in`    | `oklch(0.50 0.12 158)` `#007748` | 5.55:1 | `oklch(0.78 0.12 160)` `#6bcf9d` | 8.92:1 |
| `--money-out`   | `oklch(0.55 0.15 32)` `#b94834`  | 5.14:1 | `oklch(0.74 0.13 34)` `#f18b73`  | 7.00:1 |
| `--favorite`    | `oklch(0.66 0.15 70)` `#cb7f00`  | 3.16:1 | `oklch(0.80 0.13 75)` `#eeb154`  | 8.94:1 |

Ratios are against `--card`. Each also needs a matching `-foreground` where it is used as a fill (badges, the unsaved-changes bar).

`--favorite` is an icon-only affordance (the star), so its floor is the 3:1 non-text UI threshold rather than 4.5:1. Light mode lands at 3.16:1 — do not lighten it further.

**Red/green is never the only signal.** `finance-stat-cards.tsx` already pairs the color with `TrendingUp`/`TrendingDown` icons and a signed value. That redundancy is now a system rule, not an accident: any use of `--money-in`/`--money-out` must carry an icon or a sign.

### Chart palette

Five slots in a fixed order, alternating cool and warm so that adjacent segments in a pie or stacked bar separate maximally: **violet (brand) → orange → cyan → magenta → green**. Hues `285, 40, 200, 340, 145` — spaced so that even the wrap-around pair (slot 5 → slot 1, adjacent in a pie) stays 140° apart.

| Slot                | Light                            | Dark                             |
| ------------------- | -------------------------------- | -------------------------------- |
| `--chart-1` violet  | `oklch(0.52 0.18 285)` `#6351ca` | `oklch(0.62 0.16 285)` `#7e74e1` |
| `--chart-2` orange  | `oklch(0.68 0.18 40)` `#f16935`  | `oklch(0.67 0.13 40)` `#d77755`  |
| `--chart-3` cyan    | `oklch(0.61 0.16 200)` `#009da9` | `oklch(0.66 0.12 200)` `#00a7af` |
| `--chart-4` magenta | `oklch(0.48 0.14 340)` `#8e3776` | `oklch(0.57 0.17 340)` `#b54696` |
| `--chart-5` green   | `oklch(0.49 0.14 145)` `#1a7426` | `oklch(0.52 0.15 145)` `#1b7e2a` |

Both modes pass the `dataviz` skill validator on all six checks under the strictest setting (`--pairs all`, not merely `--pairs adjacent`): lightness band, chroma floor, CVD separation, normal-vision floor, and contrast against the chart surface. Dark values are stepped for the dark surface (band L `0.48`–`0.67`), not lightened copies of the light values.

Reproduce with:

```bash
node scripts/validate_palette.js "#6351ca,#f16935,#009da9,#8e3776,#1a7426" --mode light --surface "#fffdfa" --pairs all
node scripts/validate_palette.js "#7e74e1,#d77755,#00a7af,#b54696,#1b7e2a" --mode dark  --surface "#1b1c21" --pairs all
```

**Slots are assigned by entity, never by rank.** Filtering the finance charts must not repaint the surviving categories.

### Typography

| Token            | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| `--font-sans`    | `'Inter Variable', ui-sans-serif, system-ui, sans-serif`   |
| `--font-mono`    | `'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace` |
| `--font-numeric` | `'IBM Plex Mono', ui-monospace, monospace`                 |

Both families self-hosted via `@fontsource-variable/inter` and `@fontsource/ibm-plex-mono` (weights 400/500/600), imported from `src/styles.css`. Vite emits the `.woff2` files into `dist/assets/`, where the existing service worker glob picks them up — which is what makes the offline PWA render correctly.

Remove the `@import url('https://fonts.googleapis.com/…')` line entirely. Do not replace it with a `<link>` in `index.html`; the CDN cannot be precached.

A `.tabular` utility carries the numeric role:

```css
@utility tabular {
  font-family: var(--font-numeric);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

**Where `.tabular` applies** — every rendered quantity:

- Finance: stat card values, transaction amounts, chart axis ticks and tooltip values, `filtered-summary-bar.tsx`, `stat-block.tsx`
- Notes: `formatTimeSince` output in `note-list-item.tsx` and the editor's "last edited" line, tag counts in `tag-manager-dialog.tsx`
- Habits: streak counts; Tasks: counts and deadline dates

**Where it does not apply:** prose, labels, headings, note body content, button text.

### Elevation and focus

Two system rules that the surface ladder now makes possible:

- **Light mode elevates with shadow; dark mode elevates with surface lightness.** Shadows are invisible on dark surfaces, so `Card` should carry `shadow-sm dark:shadow-none` and rely on the `background → card → popover` step instead. This is why the ladder needs three genuinely distinguishable steps.
- **Focus rings are full-opacity.** The current global `outline-ring/50` is too faint against the new dark surfaces. Replace with a 2px solid `--ring` and a 2px offset in the surrounding surface color.

### Browser chrome

`index.html` hardcodes `<meta name="theme-color" content="#111111" />`, which matches neither theme. Replace with a pair:

```html
<meta
  name="theme-color"
  content="#faf7f3"
  media="(prefers-color-scheme: light)"
/>
<meta
  name="theme-color"
  content="#131417"
  media="(prefers-color-scheme: dark)"
/>
```

The media-query pair covers `auto`, but not an explicit light choice on a dark-OS device. `applyTheme()` in `src/hooks/use-theme.ts` must also write the active background hex into the meta tag directly, and `THEME_INIT_SCRIPT` (plus its inline copy in `index.html`) must stay in sync.

## Data Model Changes

None. No store, query, schema, or type changes.

## Acceptance Criteria

- [x] Given dark mode, when any route renders, then `--background` is `#131417` and `--card` is `#1b1c21`, and card edges are visible without relying on the border. (Set in `src/styles.css`.)
- [x] Given dark mode, when body text renders on a card, then contrast is between 10:1 and 14:1 — comfortable, not maximal. (12.80:1, computed.)
- [x] Given dark mode, when muted text renders on a card, then contrast is at least 4.5:1 (up from the current 4.87:1 on background, which drops below AA on cards). (6.23:1, computed.)
- [x] Given either theme, when a `variant="default"` Button renders, then its label meets 4.5:1 against the primary fill. (Fixed the latent `--primary-foreground` bug identified during design: dark now 7.48:1, light 5.70:1.)
- [x] Given light mode, when any surface renders, then every neutral carries non-zero chroma on hue 75–85.
- [x] `--secondary` and `--muted` resolve to different values in both themes. (Light: `#f3f0ea` vs `#efece7`. Dark: `#25272c` vs `#212327`.)
- [x] `grep -rn "text-emerald-\|text-rose-\|text-amber-\|bg-emerald-\|bg-rose-\|bg-amber-\|border-emerald-\|border-rose-\|border-amber-\|fill-amber-\|fill-emerald-\|fill-rose-" src --include="*.tsx"` returns no matches. (The looser `"rose-"` pattern in the original wording of this criterion false-positives on Tailwind Typography's `dark:prose-invert` class — 3 such matches remain in `markdown-editor.tsx`, `markdown-editor-cell.tsx`, `tiptap-editor.tsx`, none of them color literals — so the criterion is restated above with a pattern that only matches real utility classes.)
- [x] Every quantity listed under "Where `.tabular` applies" renders in IBM Plex Mono with tabular figures; digits do not shift width between transactions-table rows. (`.tabular` applied at all listed sites plus habits streaks and tasks counts/deadlines, which are enumerated the same way in this doc's own typography section.)
- [x] `dist/assets/` contains `.woff2` files after `bun --bun run build`, and `dist/sw.js` lists them in its precache manifest. (Verified: `inter-latin-wght-normal-*.woff2` and `ibm-plex-mono-latin-400-normal-*.woff2` both present in the generated `dist/sw.js` precache list.)
- [x] `src/styles.css` contains no `fonts.googleapis.com` reference.
- [x] Both chart palettes pass `validate_palette.js` at `--pairs all` for their respective surfaces. (Both report `ALL CHECKS PASS`. Worst all-pairs CVD separation sits in the 6–8 WARN floor band in both modes — legal per the validator's own rule only with secondary encoding. Since nothing currently consumes `--chart-1..5` — see "Known gap" in `docs/architecture/design-system.md` — this has no live consequence yet, but whichever chart adopts these tokens must ship a legend and/or direct labels, not color alone.)
- [x] Given a finance chart with a category filter applied, when a category is removed, then the remaining categories keep their original colors. (True by construction: `getSpendingByCategory` in `finance-utils.ts` colors each bar from the category's own persisted `color` field, not an index into a shared array.)
- [ ] Given the theme is switched, then the `theme-color` meta content updates to match the active background. (Implemented in `applyTheme()`; not yet confirmed in a running browser.)
- [ ] Keyboard focus is visible on every interactive element in both themes at full ring opacity. (Implemented as a global `*:focus-visible` rule; not yet confirmed in a running browser.)
      **Interaction states (added 2026-08-13):**

- [ ] Given light mode, when the sidebar renders, then no interaction-state background on the warm field carries a hue outside 75–85 — `--sidebar-accent` and `--sidebar-active` are both warm neutrals, and the only violet in the sidebar is foreground (`--sidebar-active-foreground`, `--sidebar-ring`).
- [ ] Given either theme, when one item is selected and a different item is hovered, then the two are visually distinguishable — `--sidebar-accent` and `--sidebar-active` resolve to different values, and the selected item additionally carries brand-colored text and `font-medium`.
- [ ] Given light mode, when an item is selected, then its chip is lighter than the sidebar field (rises) while a hovered item is darker (sinks); in dark mode both rise, selected further than hover.
- [ ] Given a selected sidebar item, then its icon and label are both `--primary` at ≥4.5:1 against the chip (light 5.79:1, dark 5.84:1, computed).
- [ ] Given the collapsed rail, when an item is selected, then the icon-only button still reads as selected (surface step plus brand icon color, no rail bar to crop).
- [ ] `grep -n "0.018 285\|0.032 285" src/styles.css` returns no matches — the cool-tint accent values are gone from both themes.
- [ ] Given a dropdown menu, select menu, or table row in light mode, when an item is hovered or focused, then the wash is the warm `--accent` step, not a violet tint.
- [ ] Given the notes editor, when a table cell is selected or a column-resize handle is shown, then it is still clearly visible after `--accent` becomes a neutral (both were re-pointed at `--primary`/`--ring`).
- [x] Every use of `--money-in`/`--money-out` is accompanied by an icon or a sign. (Stat cards: `TrendingUp`/`TrendingDown` icons. Transactions table: `+`/`−` sign. Transaction form type toggle: the button text itself reads "income"/"expense".)

## Edge Cases

- **`html.auto`**: `applyTheme()` adds both `auto` and `dark` classes, so the `@custom-variant dark (&:is(.dark *))` variant resolves correctly. The OS-change listener must also update `theme-color`.
- **First paint**: the inline theme script runs before the stylesheet loads. With fonts self-hosted the FOUT window shortens, but `font-display: swap` still applies — the numeric face swapping in must not reflow stat cards. Reserve height on stat card values.
- **Notes code blocks**: `--code-*` tokens in `styles.css` were tuned against the old `#010101` dark surface. On `#1b1c21` they need re-checking; the comment tokens in particular (`oklch(0.58 0.02 280)`) will sit close to the new muted text.
- **Selection**: `body` carries `selection:bg-primary/30`. Against the lighter dark primary this needs verification for selected-text legibility.
- **Recharts**: `CHART_TOOLTIP_CURSOR` uses the raw `var(--muted)` at 0.4 opacity — it was calibrated against a near-black background and will be far more visible on `#131417`. Retune the opacity.
- **Existing users**: theme choice persists in `localStorage`; the default remains `dark`, so most users see the dark change immediately on first load.
- **`--accent` as a brand affordance, not a wash**: three sites in `styles.css` use `var(--accent)` as a deliberate _selection_ color rather than a hover wash, and neutralizing `--accent` would erase them. `.note-tiptap .selectedCell` (background `color-mix(… 15%)` + a 2px outline) and `.note-tiptap .column-resize-handle` (solid fill) must both re-point at `--primary`/`--ring`. Audit for any other `var(--accent)` in `styles.css` before flipping the token.
- **`sidebarMenuButtonVariants` outline variant**: its hover ring is `shadow-[0_0_0_1px_var(--sidebar-accent)]`, which becomes a near-invisible neutral once `--sidebar-accent` is warm. Point that ring at `--sidebar-border` or `--ring` instead.
- **Collapsed rail**: at `group-data-[state=collapsed]:size-8!` the button is icon-only. The chosen "no rail, color the icon" treatment survives this for free; a left rail bar would have needed a separate collapsed rule. This is why the rail was rejected.
- **Selected + hovered simultaneously**: hovering the already-selected item must not knock it down to the hover surface. Class order in the `cva` string has `hover:` before `data-[active=true]:`, but Tailwind emits by utility order, not string order — the active rules need to win explicitly (scope the hover rule with `not-data-[active=true]:` or re-assert active after it) and this must be checked in the browser, not assumed.
- **Dark mode is not visibly broken today** (field and accent are 10° apart in hue), so the dark changes here are for token consistency and hover/selected separation, not to fix a visual defect. Confirm the dark sidebar does not lose contrast against `--background` `#131417` once `--sidebar-active` lands at `#25272c`.

## Implementation Notes

Rough order — token layer first so every consumer inherits the change.

1. `package.json` — add `@fontsource-variable/inter`, `@fontsource/ibm-plex-mono`.
2. `src/styles.css` — remove the Google Fonts `@import`; add the fontsource imports; rewrite `:root` and `.dark` with the tables above; add semantic tokens; extend `@theme inline` with `--color-success`, `--color-warning`, `--color-money-in`, `--color-money-out`, `--color-favorite`, `--font-mono`, `--font-numeric`; add the `.tabular` utility; update the focus-ring base rule.
3. `src/styles.css` (`--code-*` block) — re-tune syntax token colors against `#1b1c21`.
4. `index.html` — paired `theme-color` metas.
5. `src/hooks/use-theme.ts` — `applyTheme()` writes `theme-color`; keep `THEME_INIT_SCRIPT` and the inline copy in sync.
6. `src/components/ui/card.tsx` — `shadow-sm dark:shadow-none`.
7. **Migrate the 13 literal sites (20 class occurrences):**
   - `src/routes/_authenticated/finance/-components/finance-stat-cards.tsx:75,82` — `emerald`/`rose` → `--money-in`/`--money-out`; add `.tabular` to values
   - `src/routes/_authenticated/finance/-components/transaction-form.tsx:201,202`
   - `src/routes/_authenticated/finance/-components/transactions-table.tsx:203,204`
   - `src/routes/_authenticated/notes/-components/note-list-item.tsx:39` — `amber` → `--favorite`
   - `src/routes/_authenticated/notes/-components/note-list.tsx:231` — same
   - `src/routes/_authenticated/notes/-components/note-editor.tsx:337` — same
   - `src/routes/_authenticated/notes/-components/tiptap-editor.tsx:54`
   - `src/components/unsaved-changes-bar.tsx:28`
   - `src/components/markdown/markdown-editor.tsx:109`, `markdown-editor-cell.tsx:51`
8. `src/routes/_authenticated/finance/-components/stat-block.tsx`, `filtered-summary-bar.tsx`, `chart-axis-tick.tsx`, `chart-card.tsx` — apply `.tabular`; retune `CHART_TOOLTIP_CURSOR`.
9. `src/routes/_authenticated/notes/-components/note-list-item.tsx`, `note-editor.tsx` — `.tabular` on timestamps.
10. `docs/architecture/` — add `design-system.md` documenting the token contract, the numeric-voice rule, the red/green redundancy rule, and the chart-slot-by-entity rule.
11. `docs/finance.md`, `docs/second-brain.md` — update once shipped.
12. `CHANGELOG.md` — entry under `## [Unreleased]`.

**Interaction-state revision (added 2026-08-13)** — token layer first again, then the one component that needs new classes:

13. `src/styles.css` `:root` — `--accent` → `oklch(0.945 0.008 82)`, `--accent-foreground` → `oklch(0.28 0.012 75)`; `--sidebar-accent` → `oklch(0.945 0.008 82)`, `--sidebar-accent-foreground` → `oklch(0.28 0.012 75)`; add `--sidebar-active: oklch(0.995 0.004 85)` and `--sidebar-active-foreground: oklch(0.52 0.17 285)`.
14. `src/styles.css` `.dark` — `--accent` → `oklch(0.285 0.010 275)`, `--accent-foreground` → `oklch(0.905 0.006 85)`; `--sidebar-accent` → `oklch(0.225 0.009 275)`, `--sidebar-accent-foreground` → `oklch(0.88 0.006 85)`; add `--sidebar-active: oklch(0.272 0.010 275)` and `--sidebar-active-foreground: oklch(0.72 0.13 285)`.
15. `src/styles.css` `@theme inline` — register `--color-sidebar-active` and `--color-sidebar-active-foreground`.
16. `src/styles.css` `.note-tiptap` rules — `.selectedCell` background/outline and `.column-resize-handle` fill move from `var(--accent)` to `var(--primary)` (see Edge Cases).
17. `src/components/ui/sidebar.tsx:395` (`sidebarMenuButtonVariants` base) — split the three collapsed states:
    - `data-[active=true]:` → `bg-sidebar-active text-sidebar-active-foreground font-medium shadow-xs dark:shadow-none` plus the light-mode hairline (`shadow-[0_0_0_1px_var(--sidebar-border)]` composed with the elevation shadow, or a `ring-1 ring-sidebar-border dark:ring-0`).
    - `hover:` / `active:` / `data-[state=open]:hover:` stay on `bg-sidebar-accent`, but must not override the selected item — see the Edge Cases note on specificity.
18. `src/components/ui/sidebar.tsx:401` — `outline` variant hover ring off `--sidebar-accent` (see Edge Cases).
19. `src/components/ui/sidebar.tsx:490,508,607,608` — `SidebarMenuAction`, `SidebarMenuBadge`, and `SidebarMenuSubButton` read `peer-data-[active=true]/menu-button:text-sidebar-accent-foreground` and `data-[active=true]:bg-sidebar-accent`; repoint the active-state ones at the new `-active` tokens so sub-items and badges track the parent's selected treatment.
20. `src/components/AppSidebar.tsx` — no change expected (it only passes `isActive`); verify.
21. `docs/architecture/design-system.md` — document the two rules from "Interaction states are made of the field": states step along L within the field's hue, and hover ≠ selected.

## Test Plan

**Unit tests:** none required — this is a token and class-name change with no logic.

**Component tests** (existing suites must keep passing):

- [ ] `finance-stat-cards` / `transactions-table` tests still pass after the class swap — check whether any assert on `emerald`/`rose` class names and update them to the token classes.
- [ ] `note-list-item` / `note-editor` tests still pass after the `amber` swap.

**Manual verification:**

- [ ] Toggle light → dark → auto on `/finance` and `/notes`; confirm no flash and that `theme-color` tracks.
- [ ] In dark mode, read a long note for a minute — confirm the halation is gone.
- [ ] Confirm cards are distinguishable from the background in dark mode with borders temporarily disabled in devtools.
- [ ] Tab through the finance filter bar and the note editor toolbar in both themes; every focus ring visible.
- [ ] Open the transactions table and confirm amount digits align vertically.
- [ ] Build, then serve `dist/` offline and confirm Inter and IBM Plex Mono still render.
- [ ] View the three finance charts through a CVD simulator (deuteranopia and protanopia) and confirm segments stay distinguishable.
- [ ] In light mode, select one sidebar item and hover a different one — confirm both states are legible at the same time and neither reads as a colored decal.
- [ ] Hover the already-selected item and confirm it does not drop to the hover surface (the specificity trap in Edge Cases).
- [ ] Collapse the sidebar and confirm the selected item still reads as selected at icon-only width.
- [ ] Open a dropdown, a select, and the transactions table in light mode; confirm hover/focus rows are warm, not violet.
- [ ] In the notes editor, select a table cell and drag a column-resize handle; confirm both are still visible after the `--accent` change.

## Open Questions

- [x] Should `--sidebar` recede (darker than background, as specced) or advance (lighter)? **Resolved: recede.** Implemented as specced — `--sidebar` is a touch darker than `--background` in both themes (dark: `#0f1013` vs `#131417`; light: `#f5f2ed` vs `#faf7f3`). The 2026-08-13 revision keeps this and depends on it: the field must sit below `--card` for the selected chip to have room to rise.
- [x] Should the fix be a different sidebar background, or a different active-state treatment? **Resolved: the active state, not the field.** The sidebar background is not the problem — a warm paper rail is correct and stays. The problem is a cool tint painted on it. Changing the field to accommodate the tint would trade a good decision for a bad one.
- [x] Should the selected item carry a left brand rail? **Resolved: no.** Brand rides on the icon and label instead. A rail would be a second brand element per row and would need its own rule for the collapsed icon-only rail.
- [x] Do the `--code-*` syntax tokens need a full re-derivation against `#1b1c21`, or does a uniform lightness nudge suffice? **Resolved: no change needed.** Computed contrast against the new dark card: `--code-fg` 11.81:1, `--code-comment` 3.95:1 (intentionally dim, italic), all syntax colors 6.7–9.5:1. All comfortably legible as-is.
- [ ] IBM Plex Mono at `text-2xl` for the balance figure — confirm it reads as an instrument rather than as code once rendered at size. Not yet checked in the running app; do this on the next `bun --bun run dev` session.

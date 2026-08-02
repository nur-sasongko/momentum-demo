---
id: 14
title: 'Chart Zoom, Pan & Readable Axis Labels'
status: done
feature: finance
created: 2026-08-02
updated: 2026-08-02
---

# Chart Zoom, Pan & Readable Axis Labels

## Problem Statement

On all three finance charts the X-axis silently discards labels. A user looking at "Spending by category" cannot tell which bar is "Entertainment" and which is "Transportation" because only some of the names are drawn; on "Spending by location" with a dozen cities, most city names disappear; on "Daily spending" over a 90-day range only a handful of dates survive. Nothing in the UI indicates that labels were dropped — the chart simply looks like it has fewer labelled bars than bars. The user must hover each bar one at a time to read a tooltip, and there is no way to give the chart more horizontal room, so a period with many categories or many days is effectively unreadable at a glance.

The cause is that all three `<XAxis>` elements use Recharts' defaults. With no `interval` set, Recharts applies `interval="preserveEnd"`, which drops any tick that would collide with its neighbour. Data volume is unbounded in every chart — `getSpendingByCategory`, `getSpendingByLocationField`, and `getDailySpendingByCategory` all return every bucket with no top-N slice — so collisions are routine, not exceptional.

## Goals

- Every category on the X axis gets a visible label. No label is ever silently dropped.
- Long labels are angled and, only when they genuinely cannot fit, truncated with an ellipsis — never overlapped, never hidden.
- A zoom control sits in the top-right corner **inside** the chart plot area, giving the user more pixels per bar on demand. Zooming in progressively reveals the full text of truncated labels.
- Pinch-to-zoom works on touch devices, and the chart can be panned in both axes (drag with a mouse, one-finger drag or scroll on touch) once it is larger than its viewport.
- Bar-click drilldown (spec 12) keeps working unchanged: a tap or click still opens the drilldown sheet, and a pan gesture that happens to end over a bar does **not**.

## Non-Goals

- **No new dependency.** The repo has no `d3`, no `@use-gesture/react`, no `react-zoom-pan-pinch`, and spec 12 already established "no new chart library". Zoom and pinch are implemented with plain pointer/touch events and a `ResizeObserver`, all of which the codebase already uses (`tasks/-components/task-board.tsx` for drag-to-pan, the existing chart tests for `ResizeObserver`).
- **No `<Brush>` component.** Recharts' `Brush` is a range _selector_ below the chart, not a zoom control. It occupies vertical space permanently, does not help with label legibility (it does not change how many characters fit), and cannot be driven by pinch.
- **No CSS `transform: scale()` zoom.** Scaling the rendered SVG would enlarge the _already-truncated_ text — "Entertainm…" would just get bigger, never becoming "Entertainment". Zoom must re-run Recharts' layout at a larger pixel size so that more characters actually fit. It would also blur strokes and scale the tooltip and controls along with the plot.
- **No zoom state in the URL.** Zoom is a transient viewing gesture, not a filter. It stays local `useState` per chart, matching the existing non-URL-synced City/Country toggle in `spending-by-location-chart.tsx`. It resets on reload and on tab switch.
- **No zoom on the Y axis value scale.** "Zoom" here means more layout space, not a narrower value domain. The Y axis always starts at 0 and always shows the full range of the visible data; zooming makes the plot taller, it does not crop the domain.
- **No synchronized zoom across the three charts.** Each chart owns its own zoom level.
- **No keyboard shortcut for zoom.** The `+` / `−` / reset controls are real focusable `<button>`s, which is the accessible path. Trapping `+`/`-` keypresses on a scroll container would conflict with page-level browser zoom expectations.
- **No top-N truncation of the data itself.** Showing "top 10 cities + Other" would be a data change with its own product questions; this spec makes all the data readable rather than hiding some of it.

## Acceptance Criteria

- [ ] Given a chart with more categories than fit comfortably, when it renders, then every category has a label — the count of X-axis labels equals the count of bars.
- [ ] Given a category whose name is too long for the space available, when it renders, then the label is angled at −35° and truncated with a trailing ellipsis, and adjacent labels do not overlap.
- [ ] Given a truncated label, when the user zooms in, then more of its characters become visible, and at sufficient zoom the full name is shown untruncated.
- [ ] Given any of the three charts, then a zoom control (−, percentage readout, +) is visible in the top-right corner of the plot area, and it does not collide with the location chart's existing City/Country selector in the card header.
- [ ] Given the chart is at 100%, then the zoom-out button and the reset button are both disabled (not hidden); given it is at maximum zoom, then the zoom-in button is disabled.
- [ ] Given the user has zoomed in, when they press the reset control, then the chart returns to 100% and scrolls back to its origin.
- [ ] Given the user zooms in via the +/− buttons, then the point at the centre of the viewport stays approximately in place rather than the view jumping to the left edge.
- [ ] Given a touch device, when the user pinches on the chart, then the chart zooms about the pinch midpoint and the surrounding page does **not** browser-zoom or scroll.
- [ ] Given a touch device and a chart wider than its viewport, when the user drags with one finger, then the chart pans.
- [ ] Given a mouse and a chart larger than its viewport, when the user presses and drags on the plot, then the chart pans in both axes.
- [ ] Given the user drags to pan and releases the pointer over a bar, then the drilldown sheet does **not** open.
- [ ] Given the user clicks (or taps) a bar without dragging, then the drilldown sheet opens exactly as it does today, for all three charts including the stacked daily segments.
- [ ] Given the chart is zoomed, when the user hovers a bar, then the tooltip and `activeBar` highlight still work and the tooltip is positioned over the correct bar.
- [ ] Given a chart in its empty state, then no zoom controls are rendered.
- [ ] Given a 90-day range on the daily chart at 100% zoom, then all 90 date labels are present and the chart is horizontally scrollable.
- [ ] Given the charts are rendered in jsdom (zero-size layout), then they render without throwing and the zoom controls are present — existing chart tests keep passing.

## Data Model Changes

None. No Zustand store, no persisted state, no Supabase query changes. All new state is component-local React state.

New non-persisted types in `src/routes/_authenticated/finance/-utils/chart-zoom.ts`:

```ts
export interface ChartContentSize {
  width: number
  height: number
}

export interface ChartZoomState {
  zoom: number
  /** Characters that fit in the angled axis band at the current zoom. */
  maxTickChars: number
}
```

## UI / UX Notes

The zoom control is an overlay pill positioned inside the plot viewport at its top-right, deliberately **not** in the card header's `CardAction` slot — that slot is already occupied on the location chart by the City/Country `Select`, and the user asked for the control to sit inside the chart container.

```
┌─ Spending by location ──────────────────── [ City ▾ ] ┐  ← CardAction (existing)
│ Expenses — Jul 1 – Jul 31                             │
│ Click a bar to see transactions · pinch or +/− to zoom│
│ ┌──────────────────────────────── [−] 150% [+] [⟲] ┐ │  ← new overlay
│ │ 400k┤ █                                          │ │
│ │ 200k┤ █    █    █                                │ │
│ │    0└─┴────┴────┴────┴────┴────┴─────────────►   │ │
│ │        ╲    ╲    ╲    ╲                          │ │
│ │      Jakarta Bandung Yogyaka… Surabaya           │ │
│ └────────────── drag / scroll / pinch ─────────────┘ │
└───────────────────────────────────────────────────────┘
```

- Controls use `<Button variant="ghost" size="icon-xs">` with lucide `Minus`, `Plus`, `RotateCcw` icons and explicit `aria-label`s, matching the icon-button convention in `category-manager.tsx`. The pill has a `bg-background/80 backdrop-blur-sm border rounded-md shadow-sm` backing so it stays legible over bars.
- A `tabular-nums` percentage readout sits between − and + so the width does not jitter as the number changes.
- The plot viewport shows `cursor-grab` / `active:cursor-grabbing` only when the content is actually larger than the viewport; otherwise there is nothing to pan and the grab cursor would be a lie.
- The existing card `hint` line gains the discovery text for the gesture, e.g. `Click a bar to see transactions · pinch or use +/− to zoom`.
- Axis labels render angled at −35° with `textAnchor="end"`, which puts the end of the text under its tick — the conventional, most readable orientation for a rotated category axis.

## Edge Cases

- **Empty state:** the card already short-circuits to a centred message when `isEmpty`. No viewport, no controls, no gesture handlers are mounted in that branch.
- **Single data point:** content width falls back to the viewport width (the min-width formula yields less than the viewport), so a lone bar is not squeezed into a 26px column on the left.
- **Zero-size viewport (jsdom / hidden tab):** `ResizeObserver` reports `0`. The content-size helper must not produce `0` or `NaN`; it falls back to the data-driven minimum width and a fixed base height, so tests and offscreen tabs render sanely.
- **Drag versus click:** Recharts fires the `<Bar>` `onClick` from a real DOM `click` on the SVG `<path>`, and a pan implemented on an ancestor does not cancel it. A pointer movement past a small threshold (~5px) marks the gesture as a pan and installs a one-shot capture-phase `click` blocker on the viewport, so the release does not open the drilldown sheet. A pinch does the same on release.
- **Passive listeners:** React attaches `touchmove` and `wheel` as **passive** listeners at the root, so `preventDefault()` from a JSX `onTouchMove`/`onWheel` handler is a no-op. Two-finger gestures are therefore made available by setting `touch-action: pan-x pan-y` on the viewport — omitting `pinch-zoom` from the value stops the browser claiming the gesture for page zoom without needing `preventDefault` at all. Ctrl/⌘+wheel zoom, which _does_ need to block page scroll, is registered manually with `{ passive: false }` in a ref effect.
- **Overscroll chaining:** the viewport uses `overscroll-contain` so panning to the end of the chart does not start scrolling the page (or trigger pull-to-refresh on mobile).
- **Daily chart legend:** the `<Legend>` lives inside the Recharts SVG and therefore scrolls out of view when the user pans. Accepted — panning away from the legend is a deliberate act, and the tooltip still names every series.
- **Y axis scrolls away when panning horizontally:** accepted as the cost of true 2D panning; the reset control is one click away, and the tooltip carries the value for any bar under the cursor.
- **Daily chart overflows at 100%:** with a minimum band width, a long date range makes the chart wider than the card by default, so it starts out horizontally scrollable rather than starting "zoomed out and unreadable". This is a visible change to the default appearance of that chart, and is the intended trade against today's silent label dropping.
- **Persistence boundary:** nothing survives reload. Zoom level and scroll position reset when the component unmounts (including switching to the Table tab and back).

## Implementation Notes

1. `src/routes/_authenticated/finance/-utils/chart-zoom.ts` (new) — pure helpers, no React: `ZOOM_MIN`/`ZOOM_MAX`/`ZOOM_STEP`, `MIN_BAND_PX`, `clampZoom`, `getContentSize({ viewportWidth, viewportHeight, dataLength, zoom })`, `getMaxTickChars(axisHeightPx)`, `truncateLabel(label, maxChars)`, and the pinch geometry helpers (`getPinchDistance`, `getPinchMidpoint`). Everything measurable lives here so it can be unit-tested without a DOM.
2. `src/routes/_authenticated/finance/-utils/use-chart-zoom.ts` (new) — the stateful hook: measured viewport size via `ResizeObserver`, `zoom` state, `zoomIn`/`zoomOut`/`reset` that re-anchor `scrollLeft`/`scrollTop` on the viewport centre, two-finger pinch handlers anchored on the pinch midpoint, mouse drag-to-pan modelled on `tasks/-components/task-board.tsx` (bail on non-primary button and non-mouse pointer type, bind move/up on `window`, suppress `user-select` while dragging), the pan/click suppression ref, and the non-passive Ctrl+wheel listener.
3. `src/routes/_authenticated/finance/-components/chart-axis-tick.tsx` (new) — `AngledCategoryTick`, a custom Recharts tick component. It reads its truncation budget from a new `ChartZoomContext`; ticks render deep inside the Recharts SVG tree where props cannot be threaded, but context still reaches them.
4. `src/routes/_authenticated/finance/-components/chart-zoom-controls.tsx` (new) — the presentational overlay pill described in UI / UX Notes.
5. `src/routes/_authenticated/finance/-components/chart-card.tsx` — collapse the duplicated height (`h-64` on the wrapper _and_ `height={256}` on `ResponsiveContainer`) into one exported constant; export `ANGLED_AXIS_HEIGHT`; bump `CHART_MARGIN.bottom` off `0` to give the angled axis breathing room; add `zoomable` and `dataLength` props; wrap the chart in the scroll viewport + sized content div + controls overlay + context provider when `zoomable`.
6. The three `spending-by-*-chart.tsx` components — identical mechanical change to each `<XAxis>`: add `interval={0}`, `height={ANGLED_AXIS_HEIGHT}`, `tick={<AngledCategoryTick />}`; pass `zoomable dataLength={data.length}` to `<ChartCard>`; extend the `hint` text. `<Bar>` handlers, `activeBar`, `<Cell>` fills, tooltips and the legend are untouched.
7. `docs/finance.md` — update the chart section once this ships. It is already stale: it refers to `src/routes/finance/` rather than the actual `src/routes/_authenticated/finance/`.

## Test Plan

**Unit tests** (`src/routes/_authenticated/finance/-utils/__test__/chart-zoom.test.ts`, new):

- [x] `clampZoom` clamps below `ZOOM_MIN` and above `ZOOM_MAX` and passes through in-range values.
- [x] `getContentSize` returns the viewport width when the data is sparse, and the data-driven minimum (`dataLength * MIN_BAND_PX + gutter`) when it is dense.
- [x] `getContentSize` scales both dimensions linearly with `zoom`.
- [x] `getContentSize` returns positive, finite numbers when `viewportWidth` and `viewportHeight` are `0` (the jsdom case).
- [x] `getMaxTickChars` increases monotonically with axis height and clamps at both its lower and upper bound.
- [x] `truncateLabel` passes short labels through unchanged, ellipsises long ones, and handles the exact-limit boundary without adding an ellipsis.
- [x] `getPinchDistance` / `getPinchMidpoint` compute the expected values for a known pair of touch points.

**Component tests** (`src/routes/_authenticated/finance/-components/__test__/chart-card.test.tsx`, new — following the `ResizeObserver` stub pattern already used in `spending-by-location-chart.test.tsx`):

- [x] Zoom controls render when `zoomable` is set and are absent when it is not.
- [x] Zoom controls are absent in the empty state even when `zoomable` is set.
- [x] Clicking "Zoom in" updates the percentage readout.
- [x] "Zoom out" and "Reset zoom" are both disabled at 100%, and enabled above 100%.
- [x] Clicking reset returns the readout to 100%.

**Existing tests:**

- [x] `spending-by-daily-chart.test.tsx` and `spending-by-location-chart.test.tsx` keep passing unmodified — unchanged by this feature; both currently fail in this repo for a pre-existing, unrelated reason (a `zod` module-resolution error in `finance-search.ts` that reproduces identically on `dev` before this change).

**Manual verification:**

- [ ] Open `/finance` → Chart tab with a long category name present; confirm every bar is labelled and long names show an ellipsis rather than disappearing.
- [ ] Press `+` twice; confirm bars widen, truncated names reveal more characters, and the chart becomes scrollable.
- [ ] Drag the plot with a mouse; confirm it pans in both axes and that releasing over a bar does **not** open the drilldown sheet.
- [ ] Click a bar without dragging; confirm the drilldown sheet opens as before, on all three charts including a stacked daily segment.
- [ ] Hover a bar while zoomed; confirm the tooltip and hover highlight track the correct bar.
- [ ] In mobile emulation: pinch to zoom, one-finger drag to pan, tap a bar to drill down; confirm the page itself never zooms and pull-to-refresh is not triggered by panning.
- [ ] Set a 90-day range; confirm the daily chart shows every date label and scrolls horizontally.
- [ ] Press reset; confirm the chart returns to 100% and scrolls back to the origin.
- [ ] Check dark mode; confirm the control pill is legible over both light and dark bars.

## Open Questions

None.

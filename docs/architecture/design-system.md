# Design System

Tokens live in `src/styles.css` (`:root` for light, `.dark` for dark). See
[`docs/specs/020-core-design-system-refresh.md`](../specs/020-core-design-system-refresh.md)
for the contrast ratios and rationale behind every value below — this doc is
the current-state reference; the spec is the historical record.

Related docs:

- `docs/architecture/feature-slices.md` for where feature UI lives
- `docs/specs/020-core-design-system-refresh.md` for the full token derivation

## Two materials, not one inverted theme

Light mode is **warm paper** (neutral hue ~80, slight chroma). Dark mode is
**deep ink** (neutral hue ~275, cooler). They are not photographic negatives
of each other — warming dark surfaces the same way light ones are warmed
makes them read as muddy brown and drags the violet accent toward grey.

Both themes use a three-step surface ladder: `--background` →
`--card`/`--secondary`/`--muted` → `--popover`. Each step must be visibly
distinct from its neighbor — `--card` and `--muted` are deliberately
different lightness values, never the same token declared twice.

**Elevation:** light mode elevates with shadow (`shadow-sm`); dark mode
elevates with surface lightness (`dark:shadow-none`, relying on the ladder).
Shadows are invisible on dark surfaces.

## Semantic tokens

| Token           | Use                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `--destructive` | Errors, delete actions — a true alarm.                                                                 |
| `--success`     | Confirmation, completed states.                                                                        |
| `--warning`     | Caution, unsaved/dirty state.                                                                          |
| `--money-in`    | Income, credit, gains.                                                                                 |
| `--money-out`   | Expenses, spending. **Not** `--destructive` — a large expense is a normal event, not a system failure. |
| `--favorite`    | Starred/favorited items.                                                                               |

**Rule: never hardcode a Tailwind color literal** (`text-emerald-600`,
`bg-amber-500`, etc.) for something that already has a semantic meaning.
If a new case doesn't fit an existing token, add one here rather than
reaching for a raw color class.

**Rule: red/green is never the only signal.** Any use of `--money-in` /
`--money-out` (or `--success` / `--destructive`) must be paired with an
icon or an explicit sign (`+`/`−`), for colorblind users and at-a-glance
scanning. See `finance-stat-cards.tsx` for the reference pattern
(`TrendingUp`/`TrendingDown` + signed value + color).

## Typography: numbers get their own voice

Three font roles:

- `--font-sans` (Inter Variable) — body copy, labels, headings, prose.
- `--font-mono` (IBM Plex Mono) — code blocks.
- `--font-numeric` (IBM Plex Mono) — every rendered quantity.

The `.tabular` utility class (`font-family: var(--font-numeric)` +
`font-variant-numeric: tabular-nums`) is the one place this is applied.
**Apply `.tabular` to every quantity a user reads as data**: balances,
transaction amounts, chart axis ticks and tooltip values, streak counts,
timestamps (`formatTimeSince`), deadlines, and item counts. Do not apply it
to prose, labels, headings, or button text — the contrast between Inter
prose and Plex Mono numerals is what makes data legible at a glance, and it
disappears if everything uses the numeric face.

When wrapping a number inside a larger string (e.g. `"3 notes"`), scope
`.tabular` to a `<span>` around just the digits, not the whole string — see
`tag-manager-dialog.tsx` for the pattern.

Fonts are self-hosted via `@fontsource-variable/inter` and
`@fontsource/ibm-plex-mono` (not the Google Fonts CDN) so the service
worker's precache glob (`**/*.woff2`, see `scripts/generate-sw.ts`) can see
them — this is what makes the installed PWA render correctly offline.

## Charts

`--chart-1` through `--chart-5` are a fixed-order categorical palette
(violet → orange → cyan → magenta → green), validated against the
`dataviz` skill's `validate_palette.js` for lightness band, chroma floor,
CVD separation, and contrast, in both themes independently (dark is not a
lightened copy of light).

**Rule: a chart slot is assigned by entity, never by rank.** If a filter
changes which categories are visible, the surviving categories must keep
their original color — don't re-index into the palette array after
filtering.

In practice, most finance charts assign color per-entity already by using
each category's own persisted `color` field (see `getSpendingByCategory` in
`finance-utils.ts`) rather than drawing from `--chart-1..5` — that satisfies
the same rule by construction. `--chart-1..5` is there for a chart that
needs a small, fixed set of series with no natural per-entity color of its
own.

Chart tooltip cursors use `var(--border)` (not `var(--muted)`) as their
highlight fill — `--card` and `--muted` are intentionally close in
lightness (the "sunken panel" step), which leaves a `--muted`-based cursor
almost invisible. `--border` sits further from `--card` in both themes.

## Focus

Global focus-visible style is a solid 2px `--ring` outline with a 2px
offset (`*:focus-visible` in `src/styles.css`), not a translucent one — full
opacity is what makes it visible on the deeper dark surfaces. Shadcn
components' own `focus-visible:ring-*` box-shadow rings (defined per
component in `src/components/ui/`) are additive on top of this and are not
touched by this rule.

## Tables

`src/components/ui/data-table.tsx` and `table.tsx` are the only place a
table's layout, density, or interaction model should be decided — feature
code declares intent through column `meta`, never through ad-hoc cell
classes. See
[`docs/specs/021-core-data-table-refinement.md`](../specs/021-core-data-table-refinement.md)
for the full rationale.

**Layout is fixed, not auto.** Every `DataTable` uses `table-layout: fixed`
with widths driven by TanStack's column-sizing state, published as
`--col-<id>-size` CSS custom properties on the `<table>` element rather than
inline pixel values per cell — this is what lets a column resize live
without re-rendering every row. A column without an explicit `size` falls
back to TanStack's default (150px), which is rarely the right width; declare
`size`/`minSize` per column.

**Alignment is declared, not styled.** Set `meta.align: 'right'` on a
column, not `className="text-right"` on its cells — this keeps the header
label and every cell aligned together by construction. **Numerics are
right-aligned.** A column carrying `.tabular` figures (see above) should
also carry `meta.align: 'right'` — tabular figures only pay off when the
digits share a right edge; left-aligned, a 4-digit and a 7-digit amount
still start at the same x but the magnitude isn't readable from shape.

**Overflow is declared per column** via `meta.overflow`: `'nowrap'`
(default — dates, amounts, badges), `'truncate'` (single-line ellipsis with
the full value in `title` — plain text that has no other overflow
strategy), or `'wrap'` (lets the row grow). **Don't reach for `'truncate'`
on a column whose cell renderer already manages its own overflow** (e.g. a
`line-clamp-2` preview) — `truncate`'s `white-space: nowrap` cascades down
and collapses a multi-line clamp to one line. Use `'wrap'` there instead, as
`transactions-table.tsx`'s Note column does for `MarkdownEditorCell`.

**Striping and hover must differ by hue, not opacity.** A stripe and a
hover state that are the same token at different opacities become
indistinguishable on the rows where they overlap. Hover and selected use
`--accent` (violet-tinted in both themes); stripe uses a quieter
`--muted`.

**Density** (`compact` / `default` / `comfortable`) is a fixed set of
height/padding classes per row, not ad-hoc padding at each call site — see
`DENSITY_HEADER_ROW_CLASSES`/`DENSITY_CELL_CLASSES` in `data-table.tsx`.

## Known gap

`LOCATION_CHART_COLORS` in
`src/routes/_authenticated/finance/-utils/finance-utils.ts` is a hardcoded
8-color hex array for the "spending by location" chart. It predates the
token system, doesn't respond to theme, and hasn't been run through the
palette validator. Migrating it to token-backed, theme-aware colors is
follow-up work, not yet specced.

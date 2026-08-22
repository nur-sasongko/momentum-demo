---
id: 26
title: 'Export a Note to PDF: Real Text, Not Screenshots'
status: in-progress
feature: notes
created: 2026-08-22
updated: 2026-08-22
---

# Export a Note to PDF: Real Text, Not Screenshots

## Problem Statement

A note in Second Brain can only be read inside Second Brain. There is no way to
hand a note to someone who does not have an account, attach a research summary to
an email, print a checklist, or keep an offline copy of a document that survives
losing access to the app. The only escape hatch today is the browser's own
`Ctrl`/`Cmd`+`P`, which prints the live `/notes` DOM: fixed-height panes
(`index.tsx` — `h-[calc(100svh-var(--topbar-height))]`), a scrollable list rail, a
floating unsaved-changes bar, and an outline FAB all land on the page, and only the
first screenful of the note body survives. The feature doc has listed "optional
export/import of notes" under Future improvements since the Tiptap refactor
([`docs/second-brain.md`](../second-brain.md) — Future improvements) and it has
never been specified.

## Goals

- **Export the note that is open in the editor as a PDF, in one action**, from the
  editor's overflow menu. One note, one file.
- **Every glyph in the output is text.** The PDF must be selectable, searchable,
  copy-pasteable, and screen-reader-readable, at any zoom, with no rasterized page
  images anywhere in the pipeline.
- **Fixed A4 portrait output**, identical on every platform, with page geometry the
  layout derives from rather than guesses at.
- **Never export an unsaved note silently.** A dirty note is saved first, with the
  user's confirmation, so the file on disk and the row in the database say the same
  thing.
- Preserve document structure, not just words: headings, nested lists, task lists,
  tables, code blocks, callouts, blockquotes, images, and links each map onto a
  real PDF construct.
- Keep the export path off the critical rendering path — the PDF engine must not
  appear in the `/notes` route bundle, and must still work offline.
- Make the JSON → PDF transform a **pure, unit-testable function** with no DOM, no
  canvas, and no browser dependency.

## Non-Goals

- **No rasterization. Not as a fallback, not for "hard" nodes.** `html2canvas`,
  `dom-to-image`, `jsPDF.html()`, and every other screenshot-the-DOM approach are
  rejected outright — see "Why not screenshot the DOM" below. Nothing in this
  feature may introduce a `<canvas>` element or an `<img>`-of-a-page.
- **No multi-note export.** Not the filtered list, not the whole library, not a
  selection. One note — the open one — per export. This is the deliberate v1 scope;
  see "One note, and only the open one" for what that buys and
  [Open Questions](#open-questions) for the follow-up.
- **No cover page and no table of contents.** Both exist to make a
  hundred-note document navigable; in front of a single note they are ceremony. The
  PDF opens on the note's own title.
- **No export entry point in the list pane.** No footer button, no per-row action,
  no context menu on a list item — each of those implies a scope this spec does not
  ship.
- **No change to how the app loads fonts.** The TTFs added under `public/fonts/pdf/`
  are consumed by the PDF builder only. `styles.css` keeps its `@fontsource*` WOFF2
  imports; no `@font-face` is added, and the UI's font payload does not change.
- **No page-size or orientation options.** A4 portrait, always — no Letter, no
  legal, no landscape, no margin controls, no "fit to page" scaling.
- **No export options at all.** No include-tags / include-dates / page-break
  checkboxes. The note's title, tags, and edited date always print; that is one
  fewer dialog and one fewer thing to persist.
- **No server-side rendering service.** The app is a static SPA with no backend of
  its own ([`004`](./004-core-remove-ssr.md)); a headless-Chrome PDF service would
  reintroduce one.
- **No pixel-perfect reproduction of the editor.** The PDF is a print document with
  its own page geometry, measure, and type scale. Screen chrome (bubble menus, the
  outline rail, the byline's `＋` trigger, resize handles) has no print equivalent
  and is not reproduced.
- **No PDF bookmarks / outline panel.** pdfmake has no outline API, and a single
  note does not need one.
- **No syntax colors in code blocks in v1.** Monospace, preserved indentation, and
  a tinted block, but a single foreground color. Mapping `.hljs-*` classes to hex
  would duplicate the palette in `styles.css`. Deferred to a follow-up.
- **No other export formats.** Markdown, HTML, DOCX, JSON round-trip, and
  zip-of-many-files are out of scope. This spec ships exactly one artifact type:
  a single `.pdf`.
- **No import.** The other half of the feature doc's "export/import" line is a
  separate spec.
- **No data model changes.** No migration, no new column, no store version bump.
- **No changes to the save model.** Explicit save
  ([`017`](./017-notes-editor-explicit-save.md)) is respected, not bypassed: export
  triggers the same content mutation the editor already uses, and never writes
  anything the user did not confirm.
- **No export from `/archive`.** Archived notes are not open in the editor, so they
  have no export affordance ([`docs/archive.md`](../archive.md)).
- **No print stylesheet.** `Ctrl`/`Cmd`+`P` behavior is unchanged by this spec and
  stays as unsatisfying as it is today; the menu item is the supported path.

## Design Decisions

### One note, and only the open one

Scope is fixed at "the note in the editor". There is no scope picker, no dialog to
choose in, and exactly one entry point — which means the entire feature is a menu
item plus a confirm dialog that only appears when it has something to ask.

That is not a shortcut around a hard problem; it is what removes the hard problems
from v1. A library-wide export needs a cover page, a generated table of contents,
chunked fetching (the list pane holds `NoteSummary` rows — no `content`), a
progress bar, an abort path, a cap so a 300-note export cannot lock the tab, and a
rule for what a `[[` link means when its target is not in the export set. None of
that is needed to put one note on paper, and none of it can be designed well before
the transform below is proven on real notes. The transform is the part worth
getting right first; it is also the part a multi-note export would reuse
unchanged.

### Save first, then export

The export must never produce a file that disagrees with the stored note. Under
explicit save ([`017`](./017-notes-editor-explicit-save.md)) the on-screen draft and
the saved row can differ for as long as the user keeps typing, so export starts by
resolving that difference rather than picking a side:

```
Export as PDF
      │
      ├─ isDirty === false ──────────────────────────────► generate → download
      │
      └─ isDirty === true
             │
             ▼
       ConfirmDialog: "Save before exporting?"
             │
             ├─ Cancel ──────────────────────────────────► nothing happens
             │                                             (no save, no file)
             └─ Save & export ─► flush() ─┬─ success ────► generate → download
                                          └─ failure ────► error toast, no file
```

Three properties this buys:

- **A clean note exports in one click.** The confirm dialog is not a speed bump on
  the common path — it only mounts when `isDirty` is true.
- **The file always matches the database.** Whatever is in the PDF was saved to
  Postgres first, so "the PDF I sent" and "the note I have" can never drift.
- **Export never writes without consent.** Silently saving as a side effect of
  export would be exactly the phantom write [`017`](./017-notes-editor-explicit-save.md)
  exists to prevent. The user is asked, in the dialog, in those words.

`isDirty` already exists in `NoteEditor` (`note-editor.tsx:135`) and is already
`false` for read-only notes, so a locked note takes the clean path with no extra
branch.

**One refactor this needs:** `flush(current)` (`note-editor.tsx:176`) fires
`updateContent.mutate` and returns `void`, so there is currently nothing to await.
Export needs to know whether the save landed before it builds anything. `flush`
gains a `Promise<boolean>` return by switching its internals to `mutateAsync` while
keeping its existing `onSuccess`/`onError` behavior, so every current caller (pane
blur, note switch, route change, unmount, `Ctrl`/`Cmd`+`S`, the
`UnsavedChangesBar`) is unaffected and export can `await` it.

Once the save resolves, the export reads the **saved snapshot**, not the draft — by
then they are equal, and reading the snapshot means there is exactly one source of
truth in the code path instead of two that are expected to agree.

### Why not screenshot the DOM

The common way to get a PDF out of a React app is to render the DOM to a canvas
and paste the bitmap into a page. It is also the wrong output. A rasterized page
is not a document — the text cannot be selected, searched, copied, indexed, or
read by a screen reader; it blurs when zoomed or printed at anything other than
the capture DPI; a long note becomes megabytes of PNG; and every piece of chrome
that happens to be on screen is baked in permanently.

It is also structurally fragile in exactly this app. `html2canvas` reimplements a
CSS subset and this editor leans on the parts it reimplements badly: Tailwind v4's
`oklch()` color tokens, CSS variables that change per theme, `position: sticky`
code-block headers, `table-layout: fixed` with resize handles, and content that
lives inside a scroll container whose height is `calc(100svh - …)`. Capturing it
means measuring a container that is deliberately viewport-bound, then slicing the
bitmap on arbitrary pixel boundaries — which is how you get a heading cut in half
across a page break.

The alternative is not harder, it is just different: the note is **already**
structured data. `content` is ProseMirror JSON, not HTML soup. Walking that tree
and emitting document primitives skips the DOM entirely, which makes the whole
pipeline pure, testable in jsdom-free unit tests, and immune to every styling
concern above.

### The engine: pdfmake, dynamically imported

The transform needs a target with a real text layout engine — line breaking, page
breaking, repeated table headers, and font embedding — because writing those by
hand is the actual cost of "no rasterization".

| Option                    | Verdict                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jsPDF` + `html2canvas`   | **Rejected** — this is the screenshot approach.                                                                                                                                                                                                                    |
| `pdf-lib`                 | **Rejected** — excellent for editing existing PDFs, but has no layout engine. Every line break, page break, and table would be hand-computed in app code.                                                                                                          |
| `@react-pdf/renderer`     | **Rejected** — nice JSX authoring, but no table primitive. Tiptap tables carry `colspan`/`rowspan`/`colwidth`, so tables would be hand-rolled flexbox. Also heavy.                                                                                                 |
| Browser print + print CSS | **Rejected** — free fidelity, but the user must pick "Save as PDF" from a dialog, the filename and page furniture are browser-controlled, and the output depends on which browser is printing.                                                                     |
| **`pdfmake`**             | **Chosen** — declarative document definition, native `table` with `colSpan`/`rowSpan`/`headerRows`, nested `ol`/`ul`, inline mark styling, page footers with `pageCount`, and vector `canvas` primitives. Covers this node set with the least bespoke layout code. |

Because it is a ~1 MB dependency serving one menu item, pdfmake is loaded with a
dynamic `import()` inside the export entry point — never at module scope of any
component. Vite emits it as its own chunk, the `/notes` route bundle is unchanged,
and `scripts/generate-sw.ts` precaches `**/*.js` in `dist/` (`generate-sw.ts:39`),
so the chunk is in the Workbox manifest and **export works offline** — which
matters for a PWA whose whole point is a personal knowledge base.

### The transform is a pure function

The one architectural rule of this feature:

> `tiptapToPdfContent(note)` takes ProseMirror JSON and returns a pdfmake content
> array. It touches no DOM, no editor instance, no store, no window.

Everything about the output that is worth testing — that an H2 becomes a `style:
'h2'` node, that a nested `bulletList` nests, that a `colspan: 2` cell emits
`colSpan: 2`, that an unknown node type degrades to its text instead of vanishing
— is then a plain assertion on a returned object, in a `-utils/__test__/` file, with
no render, no mock canvas, and no snapshot of a binary. The impure parts (awaiting
the save, calling pdfmake, triggering the download) stay in a thin shell around it.

### Node mapping

The mapping below covers the full extension stack in
[`tiptap-extensions.ts`](../../src/routes/_authenticated/notes/-utils/tiptap-extensions.ts).
Anything not in this table is handled by the unknown-node rule at the end.

| Tiptap node                  | PDF representation                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` (1–3)              | `style: 'h1'`/`'h2'`/`'h3'`, `keepWithNext` so a heading never lands alone at the foot of a page. H4–H6 clamp to `h3`, matching `note-outline.ts`.                                                                                                                                                                    |
| `paragraph`                  | `text` node with the inline run array below                                                                                                                                                                                                                                                                           |
| `bulletList` / `orderedList` | pdfmake `ul` / `ol`, recursive for nesting                                                                                                                                                                                                                                                                            |
| `taskList` / `taskItem`      | Two-column borderless table: a vector `canvas` square (plus a vector check polyline when `checked`) and the item content. No glyph, no image.                                                                                                                                                                         |
| `blockquote`                 | Single-cell table with a left rule drawn by a `layout`, indented, body text in muted gray                                                                                                                                                                                                                             |
| `horizontalRule`             | `canvas` line at content width                                                                                                                                                                                                                                                                                        |
| `codeBlock`                  | Single-cell table, tinted fill, monospace font, `preserveLeadingSpaces: true`; the `language` attribute renders as a small caption above the block                                                                                                                                                                    |
| `table` + row/header/cell    | pdfmake `table`; `headerRows: 1` when the first row is `tableHeader` (so the header repeats across page breaks); `colSpan`/`rowSpan` from the node's `colspan`/`rowspan` attrs; `widths` derived from `colwidth` normalized to the content width, `'*'` when absent; per-cell `alignment` from the cell's `textAlign` |
| `callout`                    | Single-cell table with `fillColor`, a left rule, and the callout's emoji/icon as text                                                                                                                                                                                                                                 |
| `image`                      | `image: <dataURL>` — see "Images" below                                                                                                                                                                                                                                                                               |
| `hardBreak`                  | `\n` inside the current run                                                                                                                                                                                                                                                                                           |
| **Unknown node**             | Recurse into `content` and emit its text as a plain paragraph. Never drop a subtree silently; count it and report it — see "No silent loss".                                                                                                                                                                          |

Marks, applied to inline runs:

| Mark                    | PDF                                                             |
| ----------------------- | --------------------------------------------------------------- |
| `bold`                  | `bold: true`                                                    |
| `italic`                | `italics: true`                                                 |
| `strike`                | `decoration: 'lineThrough'`                                     |
| `code`                  | monospace font + `background`                                   |
| `highlight`             | `background` from the mark's color attr                         |
| `link` (external)       | `link: <href>`, blue + underlined — a real clickable annotation |
| `link` (`[[` note link) | Styled text, **no annotation** — see below                      |

### `[[` note links print as text, not dead links

A single-note export has no other notes in it, so an internal note link has no
destination to point at. Linking it to the app URL is worse than useless in a file
meant to be readable by someone without an account, and a link annotation that goes
nowhere is worse than plain text. So a note link renders with the app's link styling
(so the reader can see it was a link) and no clickable target.

This is the one mapping a multi-note export would change rather than reuse: with
several notes in one file, each gets a named destination and in-set links become
real internal jumps. Designing that now would be designing for a document shape
this spec does not produce.

### Page size: A4 portrait, fixed

Every exported PDF is **A4 portrait**, on every platform, with no option to change
it. A4 is the paper this library gets printed on, and a document whose page size
depends on the exporting browser's locale is not a document you can hand to
someone.

pdfmake is told so explicitly rather than left to default:

```ts
{ pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [56, 56, 56, 56] }
```

That fixes the geometry the rest of the layout derives from, in PDF points
(1pt = 1/72in):

| Quantity          | Value                                            |
| ----------------- | ------------------------------------------------ |
| Page              | 595.28 × 841.89 pt (210 × 297 mm)                |
| Margins           | 56 pt all sides (≈19.8 mm)                       |
| **Content width** | **483.28 pt** — the one number layout depends on |
| Content height    | 729.89 pt, less the footer band                  |

`CONTENT_WIDTH = 483.28` is a single exported constant in `pdf-document.ts`, and
everything that needs to fit the page reads it rather than carrying its own copy:
image scaling, the `horizontalRule` canvas, code-block and callout wrappers, and
table column widths. Two consequences worth stating:

- **Tiptap `colwidth` is CSS pixels; pdfmake `widths` are points.** Converting is
  `pt = px × 0.75` (96dpi → 72dpi), then scaling the row proportionally down if the
  total exceeds `CONTENT_WIDTH` — a table the user widened past the pane on screen
  must still fit A4, not run off the page.
- **Images cap at `CONTENT_WIDTH`**, never upscaled beyond their natural size.

### Typography

A print document, not a screenshot of a screen — so it gets print defaults rather
than the app's screen tokens:

- **Body 10.5pt / 1.4 line height**, headings at 20/15/12.5pt, code and inline code
  at 9pt monospace.
- **Footer**: `<page> / <pageCount>`, right-aligned, muted. **Header**: none.
- **Always light**: paper is white, ink is near-black, regardless of the app's
  current theme. The PDF does not inherit dark mode.
- **Fonts**: Inter for text, IBM Plex Mono for code — the app's own typefaces, so a
  printed note reads like the app. These are embedded from static TTFs served out of
  `public/fonts/pdf/`, not from the `@fontsource*` packages the UI uses — see
  "Fonts" below for why they cannot be shared.

### Fonts: static TTFs in `public/fonts/pdf/`, fetched on demand

The app loads Inter and IBM Plex Mono through `@fontsource-variable/inter` and
`@fontsource/ibm-plex-mono`, and **the PDF cannot reuse either**. Those packages ship
WOFF2, and Inter's is a variable face; pdfmake's embedder (PDFKit + fontkit) wants
static, single-instance **TTF**. So the PDF gets its own copy of the same typefaces,
in the format it can actually embed.

The files are already downloaded to `temp/IBM_Plex_Mono,Inter/` and get moved to
`public/fonts/pdf/` — six faces, renamed on the way:

| Destination in `public/fonts/pdf/` | Source in `temp/IBM_Plex_Mono,Inter/`    |   Size |
| ---------------------------------- | ---------------------------------------- | -----: |
| `Inter-Regular.ttf`                | `Inter/static/Inter_18pt-Regular.ttf`    | 335 KB |
| `Inter-Bold.ttf`                   | `Inter/static/Inter_18pt-Bold.ttf`       | 336 KB |
| `Inter-Italic.ttf`                 | `Inter/static/Inter_18pt-Italic.ttf`     | 338 KB |
| `Inter-BoldItalic.ttf`             | `Inter/static/Inter_18pt-BoldItalic.ttf` | 340 KB |
| `IBMPlexMono-Regular.ttf`          | `IBM_Plex_Mono/IBMPlexMono-Regular.ttf`  | 131 KB |
| `IBMPlexMono-Bold.ttf`             | `IBM_Plex_Mono/IBMPlexMono-Bold.ttf`     | 133 KB |
| `OFL-Inter.txt`                    | `Inter/OFL.txt`                          |      — |
| `OFL-IBMPlexMono.txt`              | `IBM_Plex_Mono/OFL.txt`                  |      — |

**≈1.6 MB total.** Four decisions got it there:

- **Inter at the 18pt optical size, not 24 or 28.** Google's static export splits
  Inter's `opsz` axis into three instances. Body copy is 10.5pt, so the smallest
  available instance is the right one — 24pt and 28pt are cut for display sizes this
  document never sets. The variable `Inter-VariableFont_opsz,wght.ttf` in the same
  download is unusable here for the reason above.
- **No mono italics.** `IBMPlexMono-Italic` and `-BoldItalic` are ~285 KB for a case
  that barely exists: an inline `code` mark inside italic text. pdfmake still needs
  all four keys of a family declared, so `italics` and `bolditalics` alias the
  upright files — italic code renders upright, which is what code should look like
  anyway.
- **Only four of Plex Mono's fourteen weights**, and none of Inter's other twelve.
  The style dictionary uses regular and bold; nothing else needs shipping.
- **The licences ship with the fonts.** SIL OFL requires it, and both downloads
  include `OFL.txt`. They are renamed rather than nested so the destination stays a
  flat directory.

`.DS_Store` files in the download are not copied, and `temp/` is deleted once the
move lands — it is not in `.gitignore` and should not become a second home for
build assets.

**These fonts are for the PDF only.** Nothing in `styles.css` or `entry-client.tsx`
should reference them; the UI keeps its WOFF2 path, which stays smaller and cached
for the app itself.

#### Loading them without weighing down the app

The fonts are **static assets fetched at export time**, not base64 baked into a JS
module. A generated `vfs.ts` full of base64 would add ~2.2 MB of JavaScript (base64
costs +33%) to be parsed on every export, for bytes the browser cache handles better
as files.

So `pdf-fonts.ts` fetches the six TTFs, converts each to base64, and builds the
pdfmake `vfs` map plus its `fonts` descriptor:

```ts
{
  Inter: {
    normal: 'Inter-Regular.ttf',
    bold: 'Inter-Bold.ttf',
    italics: 'Inter-Italic.ttf',
    bolditalics: 'Inter-BoldItalic.ttf',
  },
  IBMPlexMono: {
    normal: 'IBMPlexMono-Regular.ttf',
    bold: 'IBMPlexMono-Bold.ttf',
    italics: 'IBMPlexMono-Regular.ttf',      // aliased — see above
    bolditalics: 'IBMPlexMono-Bold.ttf',
  },
}
```

Both are passed to `createPdf(docDefinition, tableLayouts, fonts, vfs)` rather than
assigned onto the imported `pdfMake` object, so the dynamically imported module is
never mutated globally. The whole load is memoized in a module-level promise: the
first export in a session pays for it, every later one does not.

Two things this makes true, and one it costs:

- **The output PDF stays small.** PDFKit subsets embedded fonts, so a 335 KB TTF
  contributes only the glyphs the note actually uses — tens of KB, not hundreds.
- **`generate-sw.ts` must learn about `.ttf`.** Its `globPatterns`
  (`generate-sw.ts:39`) list `js,css,ico,png,svg,woff2,webmanifest` — no `ttf`, so
  the fonts would be missing from the Workbox precache and **offline export would
  fail on a cold cache**. Adding `ttf` to that list is a required step, not a
  nice-to-have. Each file is far below the existing 5 MB per-asset cap.
- **First export in a fresh session downloads ~1.6 MB** on top of the pdfmake chunk.
  Acceptable for an explicit export action, and it is exactly what the loading toast
  is covering.

#### When the fonts do not load

A 404, a cache miss offline, or a failed conversion must not turn into a failed
export. On any font-load error the document is rebuilt against PDF's standard-14
fonts — `Helvetica` for text, `Courier` for code — which need no embedding and no
network at all. The PDF looks plainer; the toast says so ("Exported … · used
fallback fonts"). Losing Inter is a cosmetic downgrade, and cosmetic downgrades
should not cost the user their file.

### The document opens on the note

No cover, no TOC. Page 1 is the note:

- **Title** at 20pt, the note's own title (or `Untitled note` when blank).
- **Byline** directly under it, 9pt muted, one line: the note's tags as `#tag`
  text, then the edited date. This mirrors `note-byline.tsx` on screen — the same
  metadata, in the same place, in print form. Word count and save status are screen
  concerns and do not print.
- **Body** from the transform.

The filename is the slugified title plus the date: `compounding-attention-2026-08-22.pdf`,
falling back to `untitled-note-<date>.pdf`.

### Feedback while it runs

One note is fast, but "fast" is not "instant" when a ~1 MB chunk has to load first
and the note has fifty images. The menu item therefore reports for itself:

- The item enters a disabled/pending state while the export runs, so it cannot be
  fired twice.
- A Sonner toast covers the wait: a loading toast that resolves into
  `Exported compounding-attention-2026-08-22.pdf`, or into an error.
- Nothing blocks the editor. The user can keep reading while the file builds.

No progress bar, no abort button, no cap — those belong to the multi-note export
that this spec explicitly does not ship.

### Images

`image` nodes hold either a base64 data URL (the `/` → Image upload path) or a
remote `https://` URL.

- **Data URL** → embedded directly, scaled to fit the content width, aspect ratio
  preserved. This is not rasterizing the page; it is including a picture the user
  put in the document.
- **Remote URL** → fetched and converted to a data URL. On CORS failure, timeout,
  or a non-PNG/JPEG type (including SVG, which pdfmake's image node does not take),
  the node becomes a bordered placeholder captioned with the image's alt text or
  URL.

### No silent loss

The transform returns `{ content, skipped }`, where `skipped` accumulates every
unknown node type and every image that could not be embedded. If `skipped` is
non-empty the success toast says so ("Exported … · 2 images could not be
embedded"). An export that quietly drops content is worse than one that admits it.

## Acceptance Criteria

**The export itself**

- [ ] Given a note is open and saved, when the user picks **Export as PDF** from the
      editor overflow menu, then a `.pdf` downloads with no intermediate dialog.
- [ ] Given the exported PDF is opened in a text-extracting tool (or `pdftotext`),
      when its text is extracted, then the note's headings, paragraphs, list items,
      table cells, and code appear as text — confirming no page was rasterized.
- [ ] Given any export, when the resulting PDF's page box is inspected (viewer
      document properties, or `pdfinfo`), then every page reports **A4 portrait —
      595 × 842 pt / 210 × 297 mm**.
- [ ] Given the exported PDF is printed on A4 paper at 100% scale (no "fit to
      page"), then nothing is clipped and no scaling prompt appears.
- [ ] Given a note titled "Compounding attention", when exported on 2026-08-22,
      then the file is named `compounding-attention-2026-08-22.pdf`.
- [ ] Given page 1 of the export, then it opens on the note's title with a byline of
      its tags and edited date — no cover page, no table of contents.

**The save gate**

- [ ] Given the open note has **no** unsaved changes, when the user exports, then no
      confirm dialog appears and no write is sent to the database.
- [ ] Given the open note **has** unsaved changes, when the user exports, then a
      confirm dialog asks to save before exporting, and no file is produced until it
      is confirmed.
- [ ] Given that dialog, when the user confirms, then the note is saved first and the
      PDF reflects the saved content — including the just-saved edit.
- [ ] Given that dialog, when the user cancels, then nothing is saved, nothing is
      downloaded, and the note stays dirty with the `UnsavedChangesBar` still shown.
- [ ] Given the save fails (offline write rejected, RLS error), when the export was
      confirmed, then an error toast explains it and **no PDF is produced**.
- [ ] Given a read-only (locked) note, when the user exports, then no confirm dialog
      appears (a locked note cannot be dirty) and the PDF is identical to the
      unlocked case — the lock is an editing constraint, not a print one.
- [ ] Given an export is already running, when the user picks the menu item again,
      then it is disabled and no second file is produced.

**Content fidelity**

- [ ] Given a note with H1–H3 headings, when exported, then each heading renders at
      its own size and no heading is the last line on a page.
- [ ] Given a note with a table that has a header row, merged cells, and per-column
      alignment, when exported, then the header repeats on each page the table spans,
      merged cells stay merged, and alignment is preserved.
- [ ] Given a note with a table the user widened past the editor pane, when
      exported, then its columns scale proportionally to fit the 483.28pt content
      width and no column runs off the page.
- [ ] Given a note with a nested bullet list and a task list, when exported, then
      nesting is preserved and task items show a filled or empty box matching their
      `checked` state.
- [ ] Given a note with a code block, when exported, then indentation and line
      breaks are preserved and the text is monospace and selectable.
- [ ] Given a note containing an uploaded (base64) image, when exported, then the
      image appears scaled to at most 483.28pt wide with its aspect ratio intact and
      is never upscaled past its natural size.
- [ ] Given a note containing a remote image that fails to load, when exported, then
      a captioned placeholder appears in its place and the success toast reports the
      skipped image.
- [ ] Given a note with an external link, when exported, then the link is clickable
      in the PDF and opens the same URL.
- [ ] Given a note with a `[[` note link, when exported, then it renders as styled
      text with no clickable annotation.
- [ ] Given an empty note (title only, empty doc), when exported, then a
      single-page PDF with the title is produced — no crash, no empty file.
- [ ] Given a note with a blank title, when exported, then the PDF reads
      `Untitled note` and the file is named `untitled-note-<date>.pdf`.

**Fonts**

- [ ] Given any export, when the PDF's embedded fonts are listed (`pdffonts`, or the
      viewer's document properties), then body text reports an embedded Inter subset
      and code reports an embedded IBM Plex Mono subset.
- [ ] Given a note mixing bold, italic, and bold-italic text, when exported, then
      each renders in the matching Inter face rather than a synthesized slant or
      weight.
- [ ] Given an inline `code` mark inside italic text, when exported, then the code
      renders upright in IBM Plex Mono (italics are intentionally aliased).
- [ ] Given a font file fails to load (404 or offline cold cache), when the user
      exports, then a PDF is still produced using standard-14 Helvetica/Courier and
      the toast reports that fallback fonts were used.
- [ ] Given the fonts loaded once in a session, when a second export runs, then the
      TTFs are not re-fetched.
- [ ] Given `bun --bun run build`, when the generated `dist/sw.js` precache manifest
      is inspected, then all six `.ttf` files under `fonts/pdf/` are listed.

**Plumbing**

- [ ] Given the app is offline (service worker active, no network) and the note is
      clean, when the user exports, then the PDF still generates with embedded Inter
      — proving the fonts came from the precache, not the network.
- [ ] Given the export runs, when the `/notes` route bundle is inspected, then
      pdfmake is in its own async chunk and not in the route's initial JS.

## Data Model Changes

**None.** No Supabase migration, no new column, no store version bump, and no new
persisted state — there are no export options left to remember.

New **types** only, in `-types/notes-pdf.ts`:

```ts
/** A note as the transform sees it — always a saved snapshot. */
export interface PdfExportNote {
  title: string
  tags: string[]
  content: JSONContent
  updatedAt: string
}

export interface PdfSkippedItem {
  kind: 'unknown-node' | 'image'
  detail: string
}

export interface PdfTransformResult {
  content: Content[] // pdfmake
  skipped: PdfSkippedItem[]
}
```

## UI / UX Notes

Editor overflow menu (`note-editor.tsx:385-419`), above the Lock separator:

```
┌──────────────────────────────┐
│ ↩  Undo               ⌘Z     │
│ ↪  Redo              ⇧⌘Z     │
├──────────────────────────────┤
│ ⤓  Export as PDF             │   ← new
├──────────────────────────────┤
│ 🔒 Lock note                 │
├──────────────────────────────┤
│ 🗄  Move to Archive          │
└──────────────────────────────┘
```

No ellipsis on the label: for a clean note this does the thing, it does not open
something. While running, the item shows a spinner and is disabled.

The dirty-note gate reuses `ConfirmDialog` (`#/components/confirm-dialog`), the same
component the archive flow uses — `confirmVariant` stays `'default'` since saving is
not destructive:

```
  ┌────────────────────────────────────────────────┐
  │  Save before exporting?                        │
  │                                                │
  │  This note has unsaved changes. They'll be     │
  │  saved first so the PDF matches your note.     │
  │                                                │
  │                  [ Cancel ]  [ Save & export ] │
  └────────────────────────────────────────────────┘
```

`DiscardChangesDialog` is deliberately **not** reused: that dialog's whole job is
offering to throw work away, and this one never discards anything.

Toasts, via the existing Sonner instance:

| Outcome            | Toast                                           |
| ------------------ | ----------------------------------------------- |
| Running            | `Building PDF…` (loading)                       |
| Success            | `Exported compounding-attention-2026-08-22.pdf` |
| Success with skips | `Exported … · 2 images could not be embedded`   |
| Save failed        | `Couldn't save the note — nothing was exported` |
| Build failed       | `Couldn't build the PDF` + the error message    |

## Edge Cases

- **Empty state:** an empty doc exports as a title-only single page; a blank title
  becomes `Untitled note`. Neither is an error.
- **Persistence boundary:** nothing new persists. The PDF is a file in the user's
  Downloads folder, not app state.
- **Dirty + save fails:** abort. No file, error toast, note stays dirty. Never
  export the draft as a consolation prize — that is the exact disagreement between
  file and database this design exists to prevent.
- **Save succeeds, build fails:** the save stands (it was confirmed and is
  independently correct), the note is now clean, and the toast reports only the
  build failure.
- **Note switched or archived mid-export:** the export holds its own snapshot of
  title/tags/content, so it finishes and downloads the note it started with.
  Unmounting `NoteEditor` does not cancel it.
- **A concurrent autosave-adjacent flush:** `flush` already no-ops when the draft
  equals the saved snapshot and when an identical draft is in flight
  (`note-editor.tsx:177-183`), so an export-triggered save racing a blur-triggered
  save cannot double-write.
- **`colwidth: null`:** Tiptap leaves `colwidth` null until a column is resized;
  fall back to `'*'` for those columns rather than emitting `NaN`. A row that mixes
  resized and unresized columns converts the known ones to points and lets `'*'`
  absorb the remainder of `CONTENT_WIDTH`.
- **Table wider than A4:** scale every column by the same factor so proportions
  survive. Never clip, never let pdfmake overflow the margin.
- **Absurd inputs:** a table with 40 columns (clamp the rendered column count and
  report the clamp in `skipped`); a 20MB base64 image (skip above a size threshold
  and report it).
- **Font fetch fails mid-export:** rebuild with the standard-14 descriptor rather
  than aborting — the note is already saved and the user asked for a file.
- **Glyphs outside Inter's coverage** (CJK, emoji in body text): Inter's Latin/Greek/
  Cyrillic coverage is what ships, so an unsupported glyph renders as a missing-glyph
  box. Detecting that per-glyph is out of scope for v1; noted here so it is not a
  surprise. Emoji in a callout icon hits the same limit.
- **iOS Safari download:** a blob download in a standalone PWA can open the PDF in a
  viewer rather than saving it. Acceptable — the user can share from there — but
  worth verifying manually.

## Implementation Notes

1. `package.json` — add `pdfmake` (+ `@types/pdfmake` in devDependencies).
2. `src/routes/_authenticated/notes/-types/notes-pdf.ts` — the types above.
3. `src/routes/_authenticated/notes/-utils/tiptap-to-pdf.ts` — **the pure
   transform.** `tiptapToPdfContent(content)` → `{ content, skipped }`, plus the
   inline-run builder for marks. No imports from pdfmake beyond types.
4. `src/routes/_authenticated/notes/-utils/pdf-document.ts` — document assembly:
   `pageSize`/`pageMargins`, `CONTENT_WIDTH`, the style dictionary, the footer, and
   the title + byline block.
5. `public/fonts/pdf/` — move the six TTFs and two `OFL.txt` files out of
   `temp/IBM_Plex_Mono,Inter/` under the destination names in the Fonts table, skip
   the `.DS_Store` files, then delete `temp/`.
6. `scripts/generate-sw.ts:39` — add `ttf` to `globPatterns` so the fonts are
   precached. Without this, offline export falls back to Helvetica.
7. `src/routes/_authenticated/notes/-utils/pdf-fonts.ts` — fetch the six TTFs,
   base64-encode, build the `vfs` map and `fonts` descriptor, memoize in a
   module-level promise, and expose the standard-14 fallback descriptor.
8. `src/routes/_authenticated/notes/-utils/pdf-images.ts` — remote URL → data URL,
   with size and MIME guards.
9. `src/utils/download.ts` — `downloadBlob(blob, filename)` and `slugify(title)`.
   Domain-free, so `src/utils/` per the promotion rule in
   [`feature-slices.md`](../architecture/feature-slices.md).
10. `src/routes/_authenticated/notes/-utils/export-note-pdf.ts` — the impure shell:
    `await import('pdfmake/build/pdfmake')`, await the fonts, build via
    `createPdf(dd, undefined, fonts, vfs)`, `getBlob()`, hand to `downloadBlob`. The
    **only** module that touches pdfmake at runtime.
11. `src/routes/_authenticated/notes/-components/note-editor.tsx` —

- `flush` returns `Promise<boolean>` (switch to `mutateAsync`, keep existing
  callbacks and no-op guards) so export can await the save;
- the **Export as PDF** menu item, its pending state, and the dirty branch;
- a second `ConfirmDialog` instance for the save gate, or a small
  `exportConfirmOpen` state alongside the existing `confirmOpen`.

12. `docs/second-brain.md` — new "Export" section; narrow the "optional
    export/import" bullet in Future improvements to import + multi-note export.
13. `docs/architecture/pwa.md` — note the `ttf` precache pattern, since offline
    export now depends on it.
14. `CHANGELOG.md` — `Added` entry under `## [Unreleased]`.

## Test Plan

**Unit tests** (`src/routes/_authenticated/notes/-utils/__test__/`):

- [ ] `tiptap-to-pdf.test.ts` — headings map to the right style and clamp H4–H6;
      paragraph marks produce the expected run array (bold, italic, strike, code,
      highlight); nested `bulletList`/`orderedList` nest; `taskItem` emits a
      `canvas` box reflecting `checked`.
- [ ] `tiptap-to-pdf.test.ts` — tables: `headerRows: 1` only when row 0 is
      `tableHeader`; `colspan`/`rowspan` → `colSpan`/`rowSpan`; `colwidth` array →
      normalized `widths`; `colwidth: null` → `'*'`; per-cell `textAlign` →
      `alignment`.
- [ ] `tiptap-to-pdf.test.ts` — external `link` mark → `link`; a `[[` note link →
      styled text with **no** `link` or `linkToDestination` key.
- [ ] `tiptap-to-pdf.test.ts` — an unknown node type is reported in `skipped` **and**
      its text still reaches the output; an empty doc yields a valid content array.
- [ ] `pdf-document.test.ts` — the document definition sets `pageSize: 'A4'`,
      `pageOrientation: 'portrait'`, and 56pt margins, and `CONTENT_WIDTH` is
      483.28; a `colwidth` row of CSS pixels converts at ×0.75 and scales down
      proportionally when the total would exceed it.
- [ ] `pdf-document.test.ts` — the title block renders the title, tags, and edited
      date; a blank title becomes `Untitled note`; the footer definition renders
      `page / pageCount`.
- [ ] `pdf-fonts.test.ts` — with `fetch` mocked, the loader requests exactly the six
      files under `/fonts/pdf/`, keys the `vfs` by the same filenames the descriptor
      references, aliases mono `italics`/`bolditalics` onto the upright files, and
      memoizes so a second call issues no further requests.
- [ ] `pdf-fonts.test.ts` — a rejected or non-OK fetch resolves to the standard-14
      fallback descriptor (Helvetica/Courier) with an empty `vfs`, and flags that
      fallback was used.
- [ ] `pdf-images.test.ts` — data URLs pass through untouched; a fetch rejection, a
      non-image MIME, and an oversized payload each produce a placeholder plus a
      `skipped` entry.
- [ ] `src/utils/__tests__/download.test.ts` — `slugify` handles punctuation,
      diacritics, emoji, and a blank title; `downloadBlob` revokes its object URL.

**Component tests** (`src/routes/_authenticated/notes/-components/__test__/`):

- [ ] `note-editor.test.tsx` — the overflow menu shows **Export as PDF**.
- [ ] `note-editor.test.tsx` — clean note: exporting calls the export shell and
      **never** calls the update mutation, with no confirm dialog rendered.
- [ ] `note-editor.test.tsx` — dirty note: exporting renders the confirm dialog and
      calls neither the mutation nor the export shell until it is confirmed.
- [ ] `note-editor.test.tsx` — dirty note, confirmed: the mutation is awaited and
      the export shell is called **after** it resolves, with the saved content.
- [ ] `note-editor.test.tsx` — dirty note, cancelled: no mutation, no export, note
      still dirty.
- [ ] `note-editor.test.tsx` — dirty note, save rejects: an error toast fires and the
      export shell is never called.
- [ ] `note-editor.test.tsx` — read-only note: exporting shows no confirm dialog.
- [ ] `note-editor.test.tsx` — the menu item is disabled while an export is pending.

**Manual verification:**

- [ ] Export a note with every block type (headings, both lists, task list, table
      with merged cells, code block, callout, blockquote, HR, uploaded image,
      external link, `[[` link) and read the PDF at 400% zoom — text stays crisp.
- [ ] Run `pdftotext` (or select-all → copy) on that PDF and confirm the body text
      comes out as text, in reading order.
- [ ] Open the PDF's document properties (or run `pdfinfo`) and confirm the page
      size reads 595 × 842 pt on every page; print one page on A4 at 100% scale.
- [ ] Run `pdffonts` on the output and confirm embedded Inter + IBM Plex Mono
      subsets, then check the file size is tens of KB of font data, not hundreds.
- [ ] Block `/fonts/pdf/*` in DevTools, export, and confirm a Helvetica PDF plus the
      fallback toast — not a failure.
- [ ] After `bun --bun run build`, grep `dist/sw.js` for `fonts/pdf` and confirm all
      six TTFs are in the precache manifest.
- [ ] Type a sentence, export without saving, confirm the dialog, and check the
      sentence is in the PDF **and** in the note after a reload.
- [ ] Repeat and cancel the dialog: no file, and the `UnsavedChangesBar` is still
      there.
- [ ] Go offline in DevTools (service worker on) and export a clean note
      successfully; then try a dirty one and confirm the failure path is honest.
- [ ] Check the built bundle: `dist/` contains a pdfmake chunk that the `/notes`
      entry does not statically import.
- [ ] Export from the installed PWA on iOS Safari and note where the file lands.

## Open Questions

- [x] **Fonts.** ~~Can Inter and IBM Plex Mono be embedded from the existing
      `@fontsource*` packages?~~ **Resolved:** no — those ship WOFF2 and a variable
      Inter, neither of which pdfmake can embed. Six static TTFs move from `temp/`
      into `public/fonts/pdf/` and are fetched at export time. See "Fonts" above.
- [ ] **Subset the TTFs?** ~1.6 MB of fonts for a Latin-only print document is more
      than it needs to be; `pyftsubset`/`subset-font` over Latin + punctuation would
      cut each Inter face from ~335 KB to well under 100 KB, taking the total nearer
      300 KB. That means adding font tooling to the build, which is why v1 ships the
      full faces. Worth doing if first-export latency is noticeable on a slow
      connection.
- [ ] **Multi-note export, later.** When the library export lands it needs a cover,
      a `tocItem` TOC, chunked fetching, progress, abort, a size cap, and internal
      `[[` destinations. Everything in steps 3–7 above is reusable as-is; the only
      mapping that changes is note links. Its own spec.
- [ ] **Syntax colors in code blocks.** `lowlight` is already a dependency and can
      tokenize to a hast tree, so colored runs are reachable — but they need a
      token → hex table that duplicates the `.hljs-*` rules in `styles.css`. Worth
      it, or is monospace enough? Follow-up spec.
- [ ] **Should the byline print tags at all?** They are useful context in a personal
      archive and noise in a document you send to someone else. Shipping with them
      on; revisit if it reads wrong on real notes.
- [ ] **Should `finance` reuse this?** Transactions as a PDF statement would share
      `src/utils/download.ts` and the page/footer conventions but none of the Tiptap
      transform. Out of scope here; noted so the shared parts stay domain-free.

## Amendments

Recorded during implementation — the sections above are left as originally
reviewed; corrections and simplifications discovered while building are noted
here rather than rewritten in place.

- **Fonts: no manual `vfs`/base64 building.** pdfmake 0.3.x (the version actually
  installed) resolves any `http(s)://` font URL itself — its internal
  `URLResolver` fetches and caches into a virtual filesystem before layout runs,
  and that cache persists across repeated `createPdf()` calls on the same module
  instance. `-utils/pdf-fonts.ts` therefore only exports absolute font-file URLs
  (`resolveEmbeddedPdfFonts()`) and the standard-14 fallback descriptor
  (`PDF_FALLBACK_FONTS`) — no fetch, no `btoa`, no memoized module-level promise.
  The "Loading them without weighing down the app" subsection's described
  `pdf-fonts.ts` (fetch six TTFs, base64-encode, build a `vfs` map) was written
  against the older pdfmake API and was never built that way. Font-load failure
  is handled where it actually occurs: `export-note-pdf.ts` tries
  `createPdf().getBlob()` with the embedded fonts and, on any rejection (network,
  404), rebuilds once with `PDF_FALLBACK_FONTS` — matching the "rebuild with
  standard-14 on failure" behavior this doc describes, just without the
  now-unnecessary fetch/probe machinery.
- **Root-relative font paths don't resolve.** pdfmake's `URLResolver` only acts on
  values starting with `http://`/`https://`; a bare `/fonts/pdf/Inter-Regular.ttf`
  is left untouched and fails to embed. `resolveEmbeddedPdfFonts()` takes
  `window.location.origin` and builds absolute URLs for exactly this reason.
- **No `keepWithNext`.** pdfmake 0.3.x has no such style property. The documented,
  correct mechanism for "a heading never lands alone at the foot of a page" is
  `TDocumentDefinitions.pageBreakBefore(currentNode, nodeQueries)`, checking
  `currentNode.headlineLevel !== undefined && nodeQueries.getFollowingNodesOnPage().length === 0`.
  Headings carry `headlineLevel` (1/2/3) for this to key off; pdfmake does not
  re-evaluate a node once it has applied a break to it, so this cannot loop even
  for a note that ends on a trailing empty heading.
- **Callout has no icon/emoji.** `callout-extension.ts`'s `Callout` node carries no
  attributes at all (`content: 'block+'`, no `attrs`), so "the callout's
  emoji/icon as text" in the node-mapping table doesn't apply — there is no icon
  to render. A callout exports as a tinted, left-ruled box with no glyph.
- **`[[` note links are detected by mark class, not URL shape.** A note link is a
  plain `link` mark with `attrs.class === 'note-internal-link'`
  (`note-link-extension.ts`) — that class, not a guess about `href` shape, is what
  `tiptap-to-pdf.ts` checks to render styled text with no annotation instead of a
  live link.
- **The byline uses an absolute timestamp, not relative time.** The design section
  says the byline "mirrors `note-byline.tsx`", which shows relative time
  (`formatTimeAgo`). A PDF is a static file that can be opened long after export —
  baking in "Edited 2 hours ago" would go stale and read as wrong the moment time
  passes. The implementation uses `formatExactTimestamp` (`#/utils/date`) instead,
  giving an absolute date that stays correct forever.
- **Exporting a just-saved note needed a fresher timestamp than the `note` prop.**
  After the save-gate's `await flush()` resolves, `NoteEditor`'s `note` prop is
  still the pre-save value for the remainder of that render (React doesn't
  re-render synchronously mid-`await`). Exporting with `note.updatedAt` at that
  point would print/name the file with the stale timestamp. `flush` now captures
  `row.updated_at` from the save mutation's own response into a ref
  (`lastSavedAtRef`), and export reads that ref instead of the prop.
- **`flush` returns `Promise<boolean>`, via `mutateAsync`.** The design section
  already called for this; noted here only to confirm it shipped exactly as
  planned, with a shared in-flight promise (`inFlightPromiseRef`) so two callers
  racing to flush an identical draft (e.g. a blur firing during an export's own
  save) await the same underlying save rather than one of them returning early
  with no way to know when the real save lands.

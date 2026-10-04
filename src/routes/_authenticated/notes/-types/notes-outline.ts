export interface OutlineEntry {
  /** 1–4; H5–H6 are clamped to 4. */
  level: 1 | 2 | 3 | 4
  text: string
  /** Ordinal among all heading nodes in the document, empty ones included. */
  domIndex: number
}

export interface OutlineEntry {
  /** 1–3; H4–H6 are clamped to 3. */
  level: 1 | 2 | 3
  text: string
  /** Ordinal among all heading nodes in the document, empty ones included. */
  domIndex: number
}

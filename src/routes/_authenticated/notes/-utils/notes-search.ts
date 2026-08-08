const TSQUERY_SPECIAL_CHARS = /[\\'&|!:]/g

function escapeTsqueryTerm(term: string): string {
  return term.replace(TSQUERY_SPECIAL_CHARS, (char) => `\\${char}`)
}

/**
 * Builds a `to_tsquery`-compatible prefix-match expression for
 * `search_vector`, e.g. `'foo':* & 'bar':*`. Returns `null` for empty or
 * whitespace-only input so callers can skip the filter entirely.
 */
export function buildNotesTsQuery(search: string): string | null {
  const terms = search.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return null

  return terms.map((term) => `'${escapeTsqueryTerm(term)}':*`).join(' & ')
}

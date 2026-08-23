const DIACRITIC_PATTERN = /[̀-ͯ]/g

/**
 * Converts a title into a lowercase, hyphenated filename stem. Falls back to
 * `fallback` when nothing alphanumeric survives (blank title, emoji-only,
 * pure punctuation).
 */
export function slugify(input: string, fallback = 'untitled'): string {
  const slug = input
    .normalize('NFKD')
    .replace(DIACRITIC_PATTERN, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

/**
 * Triggers a browser download of `blob` named `filename` via a temporary,
 * never-appended `<a download>` — no server round trip, no navigation.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

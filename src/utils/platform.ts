/**
 * Shared platform-detection helpers.
 *
 * @module utils/platform
 */

/**
 * Returns the label for the browser's save shortcut, based on the OS.
 *
 * @returns `'⌘S'` on macOS/iOS, otherwise `'Ctrl+S'`.
 *
 * @example
 * getSaveShortcutLabel() // '⌘S' on macOS
 */
export function getSaveShortcutLabel(): string {
  return typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘S'
    : 'Ctrl+S'
}

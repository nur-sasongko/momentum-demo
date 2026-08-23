import {
  CONTENT_WIDTH,
  PX_TO_PT,
} from '#/routes/_authenticated/notes/-utils/pdf-document'
import type { ResolvedPdfImage } from '#/routes/_authenticated/notes/-types/notes-pdf'

/** pdfmake only embeds JPEG/PNG — matches what this app's image node accepts. */
const SUPPORTED_MIME = new Set(['image/png', 'image/jpeg'])

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/s

/** Parses PNG/JPEG pixel dimensions straight from the file bytes — no `Image()`, no DOM. */
export function getImageDimensionsFromBytes(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  return getPngDimensions(bytes) ?? getJpegDimensions(bytes)
}

function getPngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 24 || !signature.every((byte, i) => bytes[i] === byte)) {
    return null
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

function getJpegDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    const isStandalone =
      marker === 0xd8 ||
      marker === 0xd9 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    if (isStandalone) {
      offset += 2
      continue
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    const isSofMarker =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    if (isSofMarker) {
      if (offset + 8 >= bytes.length) return null
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      }
    }
    offset += 2 + length
  }
  return null
}

/** Decodes a `data:image/...;base64,...` URL, rejecting anything but PNG/JPEG. */
export function dataUrlToBytes(
  dataUrl: string,
): { mime: string; bytes: Uint8Array } | null {
  const match = DATA_URL_PATTERN.exec(dataUrl)
  if (!match) return null
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]
  if (!SUPPORTED_MIME.has(mime)) return null

  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { mime, bytes }
  } catch {
    return null
  }
}

function bytesToDataUrl(mime: string, bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `data:${mime};base64,${btoa(binary)}`
}

async function fetchImageBytes(
  url: string,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim()
    if (!mime || !SUPPORTED_MIME.has(mime)) return null
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null
    return { mime, bytes: new Uint8Array(buffer) }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Resolves a Tiptap `image` node's `src` (data URL or remote `https://`) to
 * an embeddable data URL scaled to fit the page — never upscaled past its
 * natural size. Returns `null` on any failure so the caller can fall back to
 * a placeholder instead of failing the whole export.
 */
export async function resolvePdfImage(
  src: string,
): Promise<ResolvedPdfImage | null> {
  const decoded = src.startsWith('data:')
    ? dataUrlToBytes(src)
    : src.startsWith('http://') || src.startsWith('https://')
      ? await fetchImageBytes(src)
      : null
  if (!decoded || decoded.bytes.byteLength > MAX_IMAGE_BYTES) return null

  const dims = getImageDimensionsFromBytes(decoded.bytes)
  if (!dims) return null

  const dataUrl = src.startsWith('data:')
    ? src
    : bytesToDataUrl(decoded.mime, decoded.bytes)
  const naturalWidth = dims.width * PX_TO_PT
  const naturalHeight = dims.height * PX_TO_PT
  if (naturalWidth <= CONTENT_WIDTH) {
    return { dataUrl, width: naturalWidth, height: naturalHeight }
  }

  const scale = CONTENT_WIDTH / naturalWidth
  return { dataUrl, width: CONTENT_WIDTH, height: naturalHeight * scale }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_IMAGE_BYTES,
  resolvePdfImage,
} from '#/routes/_authenticated/notes/-utils/pdf-images'

/** A minimal (fake-payload) PNG buffer — only the signature and the IHDR
 * width/height fields (fixed offsets 16/20) are ever read by the code under
 * test, so the rest can be padding. */
function makePngBytes(
  width: number,
  height: number,
  extraBytes = 0,
): Uint8Array {
  const bytes = new Uint8Array(24 + extraBytes)
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  signature.forEach((byte, i) => (bytes[i] = byte))
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function pngDataUrl(width: number, height: number, extraBytes = 0): string {
  return `data:image/png;base64,${bytesToBase64(makePngBytes(width, height, extraBytes))}`
}

describe('resolvePdfImage — data URLs', () => {
  it('passes a data URL through untouched when it fits the content width', () => {
    return resolvePdfImage(pngDataUrl(200, 100)).then((result) => {
      expect(result?.dataUrl).toBe(pngDataUrl(200, 100))
      // 200px × 0.75 = 150pt, under CONTENT_WIDTH — unscaled.
      expect(result?.width).toBeCloseTo(150, 5)
      expect(result?.height).toBeCloseTo(75, 5)
    })
  })

  it('scales a data URL down to fit CONTENT_WIDTH, preserving aspect ratio', () => {
    // 1000px × 0.75 = 750pt, over the 483.28pt content width.
    return resolvePdfImage(pngDataUrl(1000, 500)).then((result) => {
      expect(result?.width).toBeCloseTo(483.28, 5)
      expect(result?.height).toBeCloseTo(241.64, 2)
    })
  })

  it('never upscales an image past its natural size', () => {
    return resolvePdfImage(pngDataUrl(50, 50)).then((result) => {
      expect(result?.width).toBeCloseTo(37.5, 5)
      expect(result?.height).toBeCloseTo(37.5, 5)
    })
  })

  it('rejects an unsupported MIME type embedded in the data URL', () => {
    const svgDataUrl = `data:image/svg+xml;base64,${btoa('<svg></svg>')}`
    return resolvePdfImage(svgDataUrl).then((result) => {
      expect(result).toBeNull()
    })
  })

  it('rejects a data URL payload larger than MAX_IMAGE_BYTES', () => {
    const oversized = pngDataUrl(10, 10, MAX_IMAGE_BYTES + 1)
    return resolvePdfImage(oversized).then((result) => {
      expect(result).toBeNull()
    })
  })
})

describe('resolvePdfImage — remote URLs', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('resolves a placeholder-free image when the fetch succeeds with a supported MIME', () => {
    const bytes = makePngBytes(200, 100)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(bytes.buffer),
    } as unknown as Response)

    return resolvePdfImage('https://example.com/pic.png').then((result) => {
      expect(result).not.toBeNull()
      expect(result?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    })
  })

  it('returns null on a fetch rejection (network error, CORS, timeout)', () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network error'))
    return resolvePdfImage('https://example.com/pic.png').then((result) => {
      expect(result).toBeNull()
    })
  })

  it('returns null for a non-OK response', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      headers: new Headers(),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as Response)
    return resolvePdfImage('https://example.com/pic.png').then((result) => {
      expect(result).toBeNull()
    })
  })

  it('returns null for a non-PNG/JPEG MIME type (e.g. SVG)', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/svg+xml' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as Response)
    return resolvePdfImage('https://example.com/pic.svg').then((result) => {
      expect(result).toBeNull()
    })
  })

  it('returns null for a payload over MAX_IMAGE_BYTES', () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(MAX_IMAGE_BYTES + 1)),
    } as unknown as Response)
    return resolvePdfImage('https://example.com/pic.png').then((result) => {
      expect(result).toBeNull()
    })
  })
})

describe('resolvePdfImage — unsupported src shapes', () => {
  it('returns null for a src that is neither a data URL nor an http(s) URL', () => {
    return resolvePdfImage('/relative/path.png').then((result) => {
      expect(result).toBeNull()
    })
  })
})

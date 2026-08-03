import { describe, expect, it } from 'vitest'

import {
  MIN_BAND_PX,
  MAX_TICK_CHARS,
  MIN_TICK_CHARS,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  getContentSize,
  getMaxTickChars,
  getPinchDistance,
  getPinchMidpoint,
  truncateLabel,
} from '../chart-zoom'

describe('clampZoom', () => {
  it('clamps below ZOOM_MIN', () => {
    expect(clampZoom(ZOOM_MIN - 5)).toBe(ZOOM_MIN)
  })

  it('clamps above ZOOM_MAX', () => {
    expect(clampZoom(ZOOM_MAX + 5)).toBe(ZOOM_MAX)
  })

  it('passes through in-range values', () => {
    const mid = (ZOOM_MIN + ZOOM_MAX) / 2
    expect(clampZoom(mid)).toBe(mid)
  })
})

describe('getContentSize', () => {
  it('returns the viewport width when the data is sparse', () => {
    const size = getContentSize({
      viewportWidth: 800,
      viewportHeight: 256,
      dataLength: 3,
      zoom: 1,
    })
    expect(size.width).toBe(800)
  })

  it('returns the data-driven minimum when the data is dense', () => {
    const dataLength = 40
    const size = getContentSize({
      viewportWidth: 800,
      viewportHeight: 256,
      dataLength,
      zoom: 1,
    })
    expect(size.width).toBe(dataLength * MIN_BAND_PX + 32)
    expect(size.width).toBeGreaterThan(800)
  })

  it('scales both dimensions linearly with zoom', () => {
    const base = getContentSize({
      viewportWidth: 800,
      viewportHeight: 256,
      dataLength: 40,
      zoom: 1,
    })
    const zoomed = getContentSize({
      viewportWidth: 800,
      viewportHeight: 256,
      dataLength: 40,
      zoom: 2,
    })
    expect(zoomed.width).toBe(base.width * 2)
    expect(zoomed.height).toBe(base.height * 2)
  })

  it('returns positive, finite numbers when the viewport is zero-sized (jsdom)', () => {
    const size = getContentSize({
      viewportWidth: 0,
      viewportHeight: 0,
      dataLength: 5,
      zoom: 1,
    })
    expect(Number.isFinite(size.width)).toBe(true)
    expect(Number.isFinite(size.height)).toBe(true)
    expect(size.width).toBeGreaterThan(0)
    expect(size.height).toBeGreaterThan(0)
  })
})

describe('getMaxTickChars', () => {
  it('increases monotonically with axis height', () => {
    const small = getMaxTickChars(40)
    const medium = getMaxTickChars(80)
    const large = getMaxTickChars(160)
    expect(medium).toBeGreaterThanOrEqual(small)
    expect(large).toBeGreaterThanOrEqual(medium)
  })

  it('clamps at the lower bound for a tiny axis height', () => {
    expect(getMaxTickChars(0)).toBe(MIN_TICK_CHARS)
  })

  it('clamps at the upper bound for a huge axis height', () => {
    expect(getMaxTickChars(10_000)).toBe(MAX_TICK_CHARS)
  })
})

describe('truncateLabel', () => {
  it('passes short labels through unchanged', () => {
    expect(truncateLabel('Food', 10)).toBe('Food')
  })

  it('ellipsises long labels', () => {
    expect(truncateLabel('Entertainment', 8)).toBe('Enterta…')
    expect(truncateLabel('Entertainment', 8).length).toBe(8)
  })

  it('handles the exact-limit boundary without adding an ellipsis', () => {
    expect(truncateLabel('Food', 4)).toBe('Food')
  })
})

describe('getPinchDistance', () => {
  it('computes the distance between two touch points', () => {
    expect(getPinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('getPinchMidpoint', () => {
  it('computes the midpoint between two touch points', () => {
    expect(getPinchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({
      x: 5,
      y: 10,
    })
  })
})

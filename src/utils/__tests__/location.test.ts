import { describe, expect, it } from 'vitest'

import { parseGeocoderResult, parsePlace } from '../location'

function addressComponent(
  longName: string,
  types: string[],
): google.maps.GeocoderAddressComponent {
  return { long_name: longName, short_name: longName, types }
}

function placeAddressComponent(
  longText: string,
  types: string[],
): google.maps.places.AddressComponent {
  return {
    longText,
    shortText: longText,
    types,
  } as google.maps.places.AddressComponent
}

function geocoderResult(
  overrides: Partial<google.maps.GeocoderResult> = {},
): google.maps.GeocoderResult {
  return {
    address_components: [],
    formatted_address: 'Jl. Example No. 1, South Jakarta, Indonesia',
    geometry: {} as google.maps.GeocoderGeometry,
    place_id: 'abc123',
    types: [],
    ...overrides,
  }
}

function place(
  overrides: Partial<google.maps.places.Place> = {},
): google.maps.places.Place {
  return {
    addressComponents: [],
    ...overrides,
  } as google.maps.places.Place
}

describe('parsePlace', () => {
  it('extracts place name, address, city, country, and maps url', () => {
    const result = place({
      displayName: 'Burger Dans',
      formattedAddress: 'Jl. Example No. 1, South Jakarta, Indonesia',
      addressComponents: [
        placeAddressComponent('South Jakarta', ['administrative_area_level_2']),
        placeAddressComponent('Jakarta', ['administrative_area_level_1']),
        placeAddressComponent('Indonesia', ['country']),
      ],
      googleMapsURI: 'https://maps.google.com/?cid=123',
    })

    expect(parsePlace(result)).toEqual({
      placeName: 'Burger Dans',
      address: 'Jl. Example No. 1, South Jakarta, Indonesia',
      city: 'South Jakarta',
      country: 'Indonesia',
      mapsUrl: 'https://maps.google.com/?cid=123',
    })
  })

  it('prefers locality over administrative_area levels for city', () => {
    const result = place({
      addressComponents: [
        placeAddressComponent('Bandung', ['locality']),
        placeAddressComponent('West Java', ['administrative_area_level_1']),
        placeAddressComponent('Indonesia', ['country']),
      ],
    })

    expect(parsePlace(result).city).toBe('Bandung')
  })

  it('falls back to a place id maps url when no googleMapsURI is returned', () => {
    const result = place({ id: 'abc123', addressComponents: [] })

    expect(parsePlace(result).mapsUrl).toBe(
      'https://www.google.com/maps/place/?q=place_id:abc123',
    )
  })

  it('returns empty strings for fields with no data', () => {
    const result = place({ addressComponents: [] })

    expect(parsePlace(result)).toEqual({
      placeName: '',
      address: '',
      city: '',
      country: '',
      mapsUrl: '',
    })
  })
})

describe('parseGeocoderResult', () => {
  it('preserves an existing place name when reverse-geocoding a dragged pin', () => {
    const result = geocoderResult({
      address_components: [
        addressComponent('South Jakarta', ['locality']),
        addressComponent('Indonesia', ['country']),
      ],
    })

    expect(parseGeocoderResult(result, 'Burger Dans')).toEqual({
      placeName: 'Burger Dans',
      address: 'Jl. Example No. 1, South Jakarta, Indonesia',
      city: 'South Jakarta',
      country: 'Indonesia',
      mapsUrl: 'https://www.google.com/maps/place/?q=place_id:abc123',
    })
  })

  it('falls back to the formatted address as the place name when none is given', () => {
    const result = geocoderResult()

    expect(parseGeocoderResult(result).placeName).toBe(
      'Jl. Example No. 1, South Jakarta, Indonesia',
    )
  })
})

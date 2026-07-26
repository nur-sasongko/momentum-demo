import type { TransactionLocation } from '#/stores/finance-store'

function findAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  types: string[],
): string {
  for (const type of types) {
    const match = components?.find((c) => c.types.includes(type))
    if (match) return match.long_name
  }
  return ''
}

function findPlaceAddressComponent(
  components: google.maps.places.AddressComponent[] | undefined,
  types: string[],
): string {
  for (const type of types) {
    const match = components?.find((c) => c.types.includes(type))
    if (match) return match.longText ?? ''
  }
  return ''
}

export function parsePlace(
  place: google.maps.places.Place,
): TransactionLocation {
  const components = place.addressComponents ?? undefined

  return {
    placeName: place.displayName ?? '',
    address: place.formattedAddress ?? '',
    city: findPlaceAddressComponent(components, [
      'locality',
      'administrative_area_level_2',
      'administrative_area_level_1',
    ]),
    country: findPlaceAddressComponent(components, ['country']),
    mapsUrl:
      place.googleMapsURI ??
      (place.id
        ? `https://www.google.com/maps/place/?q=place_id:${place.id}`
        : ''),
  }
}

/**
 * Builds a location from a reverse-geocoding lookup (map click / marker drag).
 * `existingPlaceName` preserves a human-picked name across fine-tune adjustments,
 * since a raw lat/lng lookup rarely resolves back to a place name.
 */
export function parseGeocoderResult(
  result: google.maps.GeocoderResult,
  existingPlaceName = '',
): TransactionLocation {
  const components = result.address_components

  return {
    placeName: existingPlaceName || result.formatted_address,
    address: result.formatted_address,
    city: findAddressComponent(components, [
      'locality',
      'administrative_area_level_2',
      'administrative_area_level_1',
    ]),
    country: findAddressComponent(components, ['country']),
    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
  }
}

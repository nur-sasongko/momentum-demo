import { env } from '#/libs/env'
import { cn } from '#/libs/utils'

import type { TransactionLocation } from '#/stores/finance-store'

function buildLocationQuery(
  location: Pick<
    TransactionLocation,
    'placeName' | 'address' | 'city' | 'country'
  >,
): string {
  if (location.address) {
    return location.placeName
      ? `${location.placeName}, ${location.address}`
      : location.address
  }
  return [location.placeName, location.city, location.country]
    .filter(Boolean)
    .join(', ')
}

export function LocationMapEmbed({
  location,
  className,
}: {
  location: TransactionLocation
  className?: string
}) {
  const query = buildLocationQuery(location)
  if (!query) return null

  return (
    <iframe
      className={cn('w-full rounded-md border-0', className)}
      src={`https://www.google.com/maps/embed/v1/place?key=${env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(query)}`}
      title={`Map showing ${location.placeName || location.address || 'saved location'}`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  )
}

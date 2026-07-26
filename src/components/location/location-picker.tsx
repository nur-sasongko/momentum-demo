import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { env } from '#/libs/env'
import { parseGeocoderResult, parsePlace } from '#/utils/location'

import type { GeoLocation } from '#/types/location'

const DEFAULT_CENTER = { lat: 0, lng: 0 }
const DEFAULT_ZOOM = 2
const SELECTED_ZOOM = 15

const PLACE_FIELDS = [
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'id',
  'googleMapsURI',
]

function MapPanner({
  position,
  panSignal,
}: {
  position: google.maps.LatLngLiteral | null
  panSignal: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || !position) return
    map.panTo(position)
    map.setZoom(SELECTED_ZOOM)
    // Deliberately keyed on panSignal (an explicit "jump to" from search), not
    // position — dragging/clicking to fine-tune the pin shouldn't fight the
    // user's current pan/zoom.
  }, [map, panSignal])

  return null
}

function PlaceSearchInput({
  onPlaceSelected,
}: {
  onPlaceSelected: (place: google.maps.places.Place) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const placesLibrary = useMapsLibrary('places')

  useEffect(() => {
    if (!placesLibrary || !containerRef.current) return

    const autocomplete = new placesLibrary.PlaceAutocompleteElement({
      placeholder: 'Search for a place…',
    })
    containerRef.current.appendChild(autocomplete)

    const handleSelect = (event: Event) => {
      const { placePrediction } =
        event as google.maps.places.PlacePredictionSelectEvent
      const place = placePrediction.toPlace()
      void place.fetchFields({ fields: PLACE_FIELDS }).then(() => {
        onPlaceSelected(place)
      })
    }
    autocomplete.addEventListener('gmp-select', handleSelect)

    return () => {
      autocomplete.removeEventListener('gmp-select', handleSelect)
      autocomplete.remove()
    }
  }, [placesLibrary, onPlaceSelected])

  return <div ref={containerRef} />
}

function LocationMap({
  position,
  panSignal,
  existingPlaceName,
  onPositionChange,
  onLocationResolved,
}: {
  position: google.maps.LatLngLiteral | null
  panSignal: number
  existingPlaceName: string
  onPositionChange: (position: google.maps.LatLngLiteral) => void
  onLocationResolved: (location: GeoLocation) => void
}) {
  const geocodingLibrary = useMapsLibrary('geocoding')
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const existingPlaceNameRef = useRef(existingPlaceName)
  existingPlaceNameRef.current = existingPlaceName

  useEffect(() => {
    if (geocodingLibrary) geocoderRef.current = new geocodingLibrary.Geocoder()
  }, [geocodingLibrary])

  const latestRequestRef = useRef(0)

  const reverseGeocode = useCallback(
    async (nextPosition: google.maps.LatLngLiteral) => {
      const geocoder = geocoderRef.current
      if (!geocoder) return

      const requestId = ++latestRequestRef.current
      try {
        const { results } = await geocoder.geocode({ location: nextPosition })
        if (requestId !== latestRequestRef.current) return
        if (results.length === 0) return

        onLocationResolved(
          parseGeocoderResult(results[0], existingPlaceNameRef.current),
        )
      } catch {
        // Keep the pin where the user placed it even if reverse geocoding fails.
      }
    },
    [onLocationResolved],
  )

  const handlePositionPicked = useCallback(
    (next: google.maps.LatLngLiteral) => {
      onPositionChange(next)
      void reverseGeocode(next)
    },
    [onPositionChange, reverseGeocode],
  )

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      gestureHandling="greedy"
      disableDefaultUI
      onClick={(e) => {
        if (e.detail.latLng) handlePositionPicked(e.detail.latLng)
      }}
    >
      <MapPanner position={position} panSignal={panSignal} />
      {position && (
        <Marker
          position={position}
          draggable
          onDragEnd={(e) => {
            const latLng = e.latLng
            if (latLng)
              handlePositionPicked({ lat: latLng.lat(), lng: latLng.lng() })
          }}
        />
      )}
    </Map>
  )
}

interface LocationPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (location: GeoLocation) => void
}

export function LocationPickerDialog({
  open,
  onOpenChange,
  onConfirm,
}: LocationPickerDialogProps) {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(
    null,
  )
  const [location, setLocation] = useState<GeoLocation | null>(null)
  const [panSignal, setPanSignal] = useState(0)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPosition(null)
      setLocation(null)
    }
    onOpenChange(next)
  }

  const handlePlaceSelected = (place: google.maps.places.Place) => {
    const placeLocation = place.location
    if (!placeLocation) return

    setPosition({ lat: placeLocation.lat(), lng: placeLocation.lng() })
    setLocation(parsePlace(place))
    setPanSignal((n) => n + 1)
  }

  const handleConfirm = () => {
    if (!location) return
    onConfirm(location)
    setPosition(null)
    setLocation(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={(e) => {
          if ((e.target as HTMLElement).closest('gmp-place-autocomplete'))
            e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if ((e.target as HTMLElement).closest('gmp-place-autocomplete'))
            e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Add location</DialogTitle>
          <DialogDescription>
            Search for a place, then click the map or drag the pin to set the
            exact spot.
          </DialogDescription>
        </DialogHeader>

        <APIProvider apiKey={env.VITE_GOOGLE_MAPS_API_KEY}>
          <div className="space-y-3">
            <PlaceSearchInput onPlaceSelected={handlePlaceSelected} />
            <div className="h-72 w-full overflow-hidden rounded-lg border">
              <LocationMap
                position={position}
                panSignal={panSignal}
                existingPlaceName={
                  location && location.placeName !== location.address
                    ? location.placeName
                    : ''
                }
                onPositionChange={setPosition}
                onLocationResolved={setLocation}
              />
            </div>
            {location && (
              <p className="text-sm text-muted-foreground">
                {location.placeName || location.address}
              </p>
            )}
          </div>
        </APIProvider>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!location} onClick={handleConfirm}>
            Use this location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

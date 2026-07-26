import { Trash2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { LocationMapEmbed } from './location-map-embed'

import type { GeoLocation } from '#/types/location'

interface LocationFieldsProps {
  location: GeoLocation
  onChange: (next: GeoLocation) => void
  onBlur?: () => void
  onRemove: () => void
  mapClassName?: string
  idPrefix?: string
}

export function LocationFields({
  location,
  onChange,
  onBlur,
  onRemove,
  mapClassName = 'h-40',
  idPrefix = 'location',
}: LocationFieldsProps) {
  const debouncedLocation = useDebouncedValue(location, 500)

  return (
    <div className="space-y-2">
      <LocationMapEmbed location={debouncedLocation} className={mapClassName} />

      <div className="grid grid-cols-1 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-place-name`}>Place name</Label>
          <Input
            id={`${idPrefix}-place-name`}
            placeholder="Place name"
            value={location.placeName}
            onChange={(e) =>
              onChange({ ...location, placeName: e.target.value })
            }
            onBlur={onBlur}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-address`}>Address</Label>
          <Textarea
            id={`${idPrefix}-address`}
            placeholder="Address"
            rows={2}
            value={location.address}
            onChange={(e) => onChange({ ...location, address: e.target.value })}
            onBlur={onBlur}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            placeholder="City"
            value={location.city}
            onChange={(e) => onChange({ ...location, city: e.target.value })}
            onBlur={onBlur}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-country`}>Country</Label>
          <Input
            id={`${idPrefix}-country`}
            placeholder="Country"
            value={location.country}
            onChange={(e) => onChange({ ...location, country: e.target.value })}
            onBlur={onBlur}
          />
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
        Remove location
      </Button>
    </div>
  )
}

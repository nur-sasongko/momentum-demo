import { MapPin } from 'lucide-react'
import { useState } from 'react'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { LocationFields } from './location-fields'
import { LocationPickerDialog } from './location-picker'

import type { GeoLocation } from '#/types/location'

function locationsEqual(a: GeoLocation | null, b: GeoLocation | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.placeName === b.placeName &&
    a.address === b.address &&
    a.city === b.city &&
    a.country === b.country &&
    a.mapsUrl === b.mapsUrl
  )
}

interface LocationCellProps {
  location: GeoLocation | null
  onSave: (location: GeoLocation | null) => void
}

export function LocationCell({ location, onSave }: LocationCellProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState(location)

  const commitDraft = (next: GeoLocation) => {
    setDraft(next)
    if (!locationsEqual(next, location)) onSave(next)
  }

  const label = location?.placeName || location?.city

  if (!location) {
    return (
      <>
        <button
          type="button"
          className="inline-flex max-w-40 items-center gap-1 rounded px-1 py-0.5 text-left text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => setPickerOpen(true)}
        >
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">Add location</span>
        </button>
        <LocationPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onConfirm={(next) => {
            setDraft(next)
            onSave(next)
          }}
        />
      </>
    )
  }

  const trigger = (
    <button
      type="button"
      className="group/editable inline-flex max-w-40 items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/60"
    >
      <MapPin className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{label}</span>
    </button>
  )

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setDraft(location)
  }

  const fields = draft && (
    <LocationFields
      idPrefix="tx-row-location"
      location={draft}
      onChange={setDraft}
      onBlur={() => commitDraft(draft)}
      onRemove={() => {
        setDraft(null)
        onSave(null)
      }}
    />
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-xl"
        >
          <SheetHeader>
            <SheetTitle>Edit location</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{fields}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        {fields}
      </PopoverContent>
    </Popover>
  )
}

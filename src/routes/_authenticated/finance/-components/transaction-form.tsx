import { zodResolver } from '@hookform/resolvers/zod'
import { startOfDay } from 'date-fns'
import { CalendarIcon, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'

import { LocationFields } from '#/components/location/location-fields'
import { LocationPickerDialog } from '#/components/location/location-picker'
import { DiscardChangesDialog } from '#/components/discard-changes-dialog'
import { Button } from '#/components/ui/button'
import { CurrencyInput } from '#/components/ui/currency-input'
import { DateTimePicker } from '#/components/ui/datetime-picker'
import { FieldError } from '#/components/ui/field-error'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { MarkdownEditor } from '#/components/markdown/markdown-editor'
import { useUnsavedChangesGuard } from '#/hooks/use-unsaved-changes-guard'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import { formatDateTimeLabel } from '#/utils/date'
import {
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
} from '../-utils/finance-queries'
import { getCategoriesForType } from '../-utils/finance-utils'

const transactionLocationSchema = z.object({
  placeName: z.string(),
  address: z.string(),
  city: z.string(),
  country: z.string(),
  mapsUrl: z.string(),
})

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be greater than 0'),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  note: z.string().max(5000).optional(),
  location: transactionLocationSchema.nullable(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

function defaultTransactionDate(): string {
  return startOfDay(new Date()).toISOString()
}

export function TransactionFormSheet() {
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const isMobile = useIsMobile()
  const isOpen = useFinanceStore((s) => s.isAddTransactionOpen)
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)
  const editingId = useFinanceStore((s) => s.editingTransactionId)
  const editingTx = useFinanceStore((s) => s.editingTransaction)
  const setEditingTransactionId = useFinanceStore(
    (s) => s.setEditingTransactionId,
  )
  const categories = useFinanceStore((s) => s.categories)

  const createMutation = useCreateTransactionMutation()
  const updateMutation = useUpdateTransactionMutation()

  const expenseCategories = getCategoriesForType(categories, 'expense')
  const defaultExpenseCategoryId = expenseCategories[0]?.id ?? ''

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'expense',
      amount: 0,
      categoryId: defaultExpenseCategoryId,
      date: defaultTransactionDate(),
      note: '',
      location: null,
    },
  })

  const location = form.watch('location')

  useEffect(() => {
    if (editingTx) {
      form.reset({
        type: editingTx.type,
        amount: editingTx.amount,
        categoryId: editingTx.categoryId,
        date: editingTx.date,
        note: editingTx.note,
        location: editingTx.location,
      })
    } else {
      form.reset({
        type: 'expense',
        amount: 0,
        categoryId: defaultExpenseCategoryId,
        date: defaultTransactionDate(),
        note: '',
        location: null,
      })
    }
  }, [editingTx, defaultExpenseCategoryId, form])

  const selectedType = form.watch('type')
  const availableCategories = [
    ...getCategoriesForType(categories, selectedType),
  ].sort((a, b) => Number(a.isSystem) - Number(b.isSystem))

  useEffect(() => {
    const currentId = form.getValues('categoryId')
    const stillValid = availableCategories.some((c) => c.id === currentId)
    if (!stillValid && availableCategories.length > 0) {
      form.setValue('categoryId', availableCategories[0].id)
    }
  }, [selectedType, availableCategories, form])

  const handleClose = () => {
    setAddTransactionOpen(false)
    setEditingTransactionId(null)
    form.reset()
  }

  const { confirmOpen, setConfirmOpen, requestClose } = useUnsavedChangesGuard(
    form.formState.isDirty,
    handleClose,
  )

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      type: values.type,
      amount: values.amount,
      categoryId: values.categoryId,
      date: values.date,
      note: values.note ?? '',
      location: values.location,
    }

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    handleClose()
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const isDirty = form.formState.isDirty

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) requestClose()
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(isMobile ? 'h-[90dvh] rounded-t-xl' : 'sm:max-w-md')}
      >
        <SheetHeader>
          <SheetTitle>
            {editingId ? 'Edit transaction' : 'Add transaction'}
          </SheetTitle>
          <SheetDescription>
            Record income or an expense. Changes save automatically.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-1">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(['expense', 'income'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      form.setValue('type', type, { shouldDirty: true })
                    }
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                      selectedType === type
                        ? type === 'income'
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-amount">Amount</Label>
              <CurrencyInput
                id="tx-amount"
                placeholder="0.00"
                value={form.watch('amount')}
                onValueChange={(value) =>
                  form.setValue('amount', value ?? 0, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
              {form.formState.errors.amount && (
                <FieldError>{form.formState.errors.amount.message}</FieldError>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch('categoryId')}
                onValueChange={(value) =>
                  form.setValue('categoryId', value, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId && (
                <FieldError>
                  {form.formState.errors.categoryId.message}
                </FieldError>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <DateTimePicker
                value={form.watch('date')}
                onChange={(isoDate) =>
                  form.setValue('date', isoDate, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('date') && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {form.watch('date')
                      ? formatDateTimeLabel(form.watch('date'))
                      : 'Pick a date'}
                  </Button>
                }
              />
              {form.formState.errors.date && (
                <FieldError>{form.formState.errors.date.message}</FieldError>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tx-note">Note</Label>
              <Controller
                name="note"
                control={form.control}
                render={({ field }) => (
                  <MarkdownEditor
                    id="tx-note"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Optional description — supports markdown"
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              {location ? (
                <div className="rounded-lg border p-3">
                  <LocationFields
                    idPrefix="tx-location"
                    location={location}
                    mapClassName="h-48"
                    onChange={(next) =>
                      form.setValue('location', next, { shouldDirty: true })
                    }
                    onRemove={() =>
                      form.setValue('location', null, { shouldDirty: true })
                    }
                  />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setLocationPickerOpen(true)}
                >
                  <MapPin className="mr-2 size-4" />
                  Add location
                </Button>
              )}
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !isDirty}>
              {isPending
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Save transaction'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>

      <LocationPickerDialog
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        onConfirm={(next) =>
          form.setValue('location', next, { shouldDirty: true })
        }
      />

      <DiscardChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={handleClose}
        description="You have unsaved changes to this transaction. Closing now will discard them."
      />
    </Sheet>
  )
}

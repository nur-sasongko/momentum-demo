import { zodResolver } from '@hookform/resolvers/zod'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import { CurrencyInput } from '#/components/ui/currency-input'
import { FieldError } from '#/components/ui/field-error'
import { Label } from '#/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
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
import { Textarea } from '#/components/ui/textarea'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import {
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
} from '../-utils/finance-queries'
import { getCategoriesForType } from '../-utils/finance-utils'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  categoryId: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  note: z.string().max(200).optional(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TransactionFormSheet() {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
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
      date: todayDateKey(),
      note: '',
    },
  })

  useEffect(() => {
    if (editingTx) {
      form.reset({
        type: editingTx.type,
        amount: editingTx.amount,
        categoryId: editingTx.categoryId,
        date: editingTx.date,
        note: editingTx.note,
      })
    } else {
      form.reset({
        type: 'expense',
        amount: 0,
        categoryId: defaultExpenseCategoryId,
        date: todayDateKey(),
        note: '',
      })
    }
  }, [editingTx, defaultExpenseCategoryId, form])

  const selectedType = form.watch('type')
  const availableCategories = getCategoriesForType(categories, selectedType)

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

  const onSubmit = form.handleSubmit(async (values) => {
    const input = {
      type: values.type,
      amount: values.amount,
      categoryId: values.categoryId,
      date: values.date,
      note: values.note ?? '',
    }

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, input })
    } else {
      await createMutation.mutateAsync(input)
    }
    handleClose()
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          isMobile
            ? 'max-h-[90dvh] overflow-y-auto rounded-t-xl'
            : 'sm:max-w-md',
        )}
      >
        <SheetHeader>
          <SheetTitle>
            {editingId ? 'Edit transaction' : 'Add transaction'}
          </SheetTitle>
          <SheetDescription>
            Record income or an expense. Changes save automatically.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 px-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              {(['expense', 'income'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setValue('type', type)}
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
                form.setValue('amount', value ?? 0, { shouldValidate: true })
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
              onValueChange={(value) => form.setValue('categoryId', value)}
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
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
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
                    ? format(parseISO(form.watch('date')), 'PPP')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    form.watch('date')
                      ? parseISO(form.watch('date'))
                      : undefined
                  }
                  onSelect={(date) => {
                    if (date) {
                      form.setValue('date', format(date, 'yyyy-MM-dd'), {
                        shouldValidate: true,
                      })
                      setDatePickerOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            {form.formState.errors.date && (
              <FieldError>{form.formState.errors.date.message}</FieldError>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea
              id="tx-note"
              placeholder="Optional description"
              rows={3}
              {...form.register('note')}
            />
          </div>

          <SheetFooter className="px-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? 'Saving…'
                : editingId
                  ? 'Save changes'
                  : 'Save transaction'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

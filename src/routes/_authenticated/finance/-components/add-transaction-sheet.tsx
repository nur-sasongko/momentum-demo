import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import { FieldError } from '#/components/ui/field-error'
import { Input } from '#/components/ui/input'
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
import { Textarea } from '#/components/ui/textarea'
import {
  EXPENSE_CATEGORIES,
  getCategoriesForType,
  INCOME_CATEGORIES,
} from '../-utils/finance-utils'
import { cn } from '#/libs/utils'
import { useIsMobile } from '#/hooks/use-mobile'
import { useFinanceStore } from '#/stores/finance-store'

import type { FinanceCategory } from '../-utils/finance-utils'
import type { TransactionType } from '#/stores/finance-store'

const addTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
  note: z.string().max(200).optional(),
})

type AddTransactionForm = z.infer<typeof addTransactionSchema>

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AddTransactionSheet() {
  const isMobile = useIsMobile()
  const isOpen = useFinanceStore((s) => s.isAddTransactionOpen)
  const setAddTransactionOpen = useFinanceStore((s) => s.setAddTransactionOpen)
  const addTransaction = useFinanceStore((s) => s.addTransaction)

  const form = useForm<AddTransactionForm>({
    resolver: zodResolver(addTransactionSchema),
    defaultValues: {
      type: 'expense',
      amount: 0,
      category: EXPENSE_CATEGORIES[0],
      date: todayDateKey(),
      note: '',
    },
  })

  const selectedType = form.watch('type')
  const categories = getCategoriesForType(selectedType)

  useEffect(() => {
    const currentCategory = form.getValues('category')
    if (!categories.includes(currentCategory as FinanceCategory)) {
      form.setValue('category', categories[0])
    }
  }, [selectedType, categories, form])

  const onSubmit = form.handleSubmit((values) => {
    addTransaction({
      type: values.type as TransactionType,
      amount: values.amount,
      category: values.category as FinanceCategory,
      date: values.date,
      note: values.note ?? '',
    })
    form.reset({
      type: 'expense',
      amount: 0,
      category: EXPENSE_CATEGORIES[0],
      date: todayDateKey(),
      note: '',
    })
  })

  return (
    <Sheet open={isOpen} onOpenChange={setAddTransactionOpen}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          isMobile
            ? 'max-h-[90dvh] overflow-y-auto rounded-t-xl'
            : 'sm:max-w-md',
        )}
      >
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
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
                  onClick={() => {
                    form.setValue('type', type)
                    form.setValue(
                      'category',
                      type === 'income'
                        ? INCOME_CATEGORIES[0]
                        : EXPENSE_CATEGORIES[0],
                    )
                  }}
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
            <Input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register('amount')}
            />
            {form.formState.errors.amount && (
              <FieldError>{form.formState.errors.amount.message}</FieldError>
            )}
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch('category')}
              onValueChange={(value) => form.setValue('category', value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" {...form.register('date')} />
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddTransactionOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save transaction</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

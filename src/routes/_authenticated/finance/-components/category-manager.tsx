import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
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
import { Separator } from '#/components/ui/separator'
import { useFinanceStore } from '#/stores/finance-store'
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
} from '../-utils/finance-queries'

import type { FinanceCategory } from '#/stores/finance-store'

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(30),
  type: z.enum(['income', 'expense']),
  color: z.string().min(4, 'Pick a color'),
})

type CategoryFormValues = z.infer<typeof categorySchema>

function CategoryRow({ cat }: { cat: FinanceCategory }) {
  const deleteMutation = useDeleteCategoryMutation()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: cat.color }}
        />
        <span className="min-w-0 flex-1 truncate text-sm">{cat.name}</span>
        <span className="text-xs text-muted-foreground">
          Transactions will move to Other.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs"
          disabled={deleteMutation.isPending}
          onClick={() => {
            deleteMutation.mutate(cat.id)
            setConfirming(false)
          }}
        >
          Delete
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: cat.color }}
      />
      <span className="min-w-0 flex-1 truncate text-sm">{cat.name}</span>
      {cat.isSystem ? (
        <span className="text-xs text-muted-foreground">system</span>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${cat.name}`}
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function AddCategoryForm() {
  const createMutation = useCreateCategoryMutation()

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', color: '#6366f1' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    await createMutation.mutateAsync(values)
    form.reset({ name: '', type: values.type, color: values.color })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-2">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="cat-name" className="text-xs">
            Name
          </Label>
          <Input
            id="cat-name"
            placeholder="e.g. Travel"
            className="h-8 text-sm"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <FieldError>{form.formState.errors.name.message}</FieldError>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={form.watch('type')}
            onValueChange={(v) =>
              form.setValue('type', v as 'income' | 'expense')
            }
          >
            <SelectTrigger className="h-8 w-[110px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="cat-color" className="text-xs">
            Color
          </Label>
          <input
            id="cat-color"
            type="color"
            className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
            {...form.register('color')}
          />
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        className="gap-1.5"
        disabled={createMutation.isPending}
      >
        <Plus className="size-3.5" />
        {createMutation.isPending ? 'Adding…' : 'Add category'}
      </Button>
    </form>
  )
}

function sortWithOtherLast(categories: FinanceCategory[]) {
  return [...categories].sort((a, b) => {
    if (a.name === 'Other') return 1
    if (b.name === 'Other') return -1
    return 0
  })
}

export function CategoryManager() {
  const categories = useFinanceStore((s) => s.categories)
  const expenseCategories = sortWithOtherLast(
    categories.filter((c) => c.type === 'expense'),
  )
  const incomeCategories = sortWithOtherLast(
    categories.filter((c) => c.type === 'income'),
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          Manage categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Add or remove categories. System categories cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expense categories
            </h3>
            <div className="space-y-0.5">
              {expenseCategories.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} />
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Income categories
            </h3>
            <div className="space-y-0.5">
              {incomeCategories.map((cat) => (
                <CategoryRow key={cat.id} cat={cat} />
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add new category
            </h3>
            <AddCategoryForm />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

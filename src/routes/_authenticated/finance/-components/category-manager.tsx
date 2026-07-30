import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { DiscardChangesDialog } from '#/components/discard-changes-dialog'
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
import { Separator } from '#/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { useUnsavedChangesGuard } from '#/hooks/use-unsaved-changes-guard'
import { cn } from '#/libs/utils'
import { useFinanceStore } from '#/stores/finance-store'
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
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
  const updateMutation = useUpdateCategoryMutation()
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: cat.name, type: cat.type, color: cat.color },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    await updateMutation.mutateAsync({ id: cat.id, ...values })
    setEditing(false)
  })

  const cancelEdit = () => {
    form.reset({ name: cat.name, type: cat.type, color: cat.color })
    setEditing(false)
  }

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

  if (editing) {
    return (
      <form
        onSubmit={onSubmit}
        className="space-y-2 rounded-lg border border-input bg-muted/30 px-2 py-2"
      >
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            className="h-8 min-w-0 flex-1 text-sm"
            {...form.register('name')}
          />

          <div className="flex gap-2">
            <Select
              value={form.watch('type')}
              onValueChange={(v) =>
                form.setValue('type', v as 'income' | 'expense')
              }
            >
              <SelectTrigger size="sm" className="flex-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
            <input
              type="color"
              className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
              {...form.register('color')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={cancelEdit}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={updateMutation.isPending}
            >
              <Check className="size-3.5" />
              Save
            </Button>
          </div>
        </div>
        {form.formState.errors.name && (
          <FieldError>{form.formState.errors.name.message}</FieldError>
        )}
      </form>
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
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Edit ${cat.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${cat.name}`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}

function AddCategoryForm({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void
}) {
  const createMutation = useCreateCategoryMutation()

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', type: 'expense', color: '#6366f1' },
  })

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  const onSubmit = form.handleSubmit(async (values) => {
    await createMutation.mutateAsync(values)
    form.reset({ name: '', type: values.type, color: values.color })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-2">
      <div className="space-y-1">
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

      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={form.watch('type')}
            onValueChange={(v) =>
              form.setValue('type', v as 'income' | 'expense')
            }
          >
            <SelectTrigger size="sm" className="w-full text-sm">
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
        className="w-full gap-1.5"
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
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [addFormDirty, setAddFormDirty] = useState(false)
  const categories = useFinanceStore((s) => s.categories)
  const expenseCategories = sortWithOtherLast(
    categories.filter((c) => c.type === 'expense'),
  )
  const incomeCategories = sortWithOtherLast(
    categories.filter((c) => c.type === 'income'),
  )

  const { confirmOpen, setConfirmOpen, requestClose } = useUnsavedChangesGuard(
    addFormDirty,
    () => setOpen(false),
  )

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true)
        } else {
          requestClose()
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-sm"
          aria-label="Manage categories"
        >
          <Settings className="size-4 sm:size-3.5" />
          <span className="hidden sm:inline">Manage categories</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(isMobile ? 'h-[85dvh] rounded-t-xl' : 'sm:max-w-md')}
      >
        <SheetHeader>
          <SheetTitle>Manage categories</SheetTitle>
          <SheetDescription>
            Add or remove categories. System categories cannot be deleted.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
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
            <AddCategoryForm onDirtyChange={setAddFormDirty} />
          </div>
        </div>
      </SheetContent>

      <DiscardChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={() => setOpen(false)}
        description="You have unsaved changes to the new category. Closing now will discard them."
      />
    </Sheet>
  )
}

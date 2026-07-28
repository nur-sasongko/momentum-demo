import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { useIsMobile } from '#/hooks/use-mobile'
import { useToast } from '#/hooks/use-toast'
import { cn } from '#/libs/utils'
import { useTasksStore } from '#/stores/tasks-store'
import {
  useCreateListMutation,
  useUpdateListMutation,
} from '../-utils/tasks-queries'
import { isValidHexColor } from '../-utils/tasks-utils'

interface NewListSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editListId?: string
}

export function NewListSheet({
  open,
  onOpenChange,
  editListId,
}: NewListSheetProps) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const createListMutation = useCreateListMutation()
  const updateListMutation = useUpdateListMutation()

  const lists = useTasksStore((s) => s.lists)

  const editList = editListId ? lists.find((l) => l.id === editListId) : null

  const isEditing = !!editListId && !!editList
  const isLoading = createListMutation.isPending || updateListMutation.isPending

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('')
      setColor('')
    }
    onOpenChange(newOpen)
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || isValidHexColor(value)) {
      setColor(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({
        variant: 'destructive',
        description: 'List name is required',
      })
      return
    }

    if (color && !isValidHexColor(color)) {
      toast({
        variant: 'destructive',
        description: 'Invalid hex color format (e.g. #FF5733)',
      })
      return
    }

    try {
      if (isEditing) {
        await updateListMutation.mutateAsync({
          id: editList.id,
          updates: {
            name: name.trim(),
            color: color || undefined,
          },
        })
        toast({
          description: 'List updated',
        })
      } else {
        await createListMutation.mutateAsync({
          name: name.trim(),
          color: color || undefined,
          order: lists.length,
        })
        toast({
          description: 'List created',
        })
      }
      handleOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error ? error.message : 'Failed to save list',
      })
    }
  }

  useEffect(() => {
    if (isEditing && open) {
      setName(editList.name)
      setColor(editList.color || '')
    } else if (!isEditing && open) {
      setName('')
      setColor('')
    }
  }, [open, isEditing, editList])

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(isMobile ? 'h-[90dvh] rounded-t-xl' : 'sm:max-w-md')}
      >
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit List' : 'Create New List'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update your list details'
              : 'Add a new task list to organize your tasks'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="list-name">List Name</Label>
              <Input
                id="list-name"
                placeholder="e.g. Work, Personal, Do Later"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="list-color">Color (Optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="list-color"
                  type="text"
                  placeholder="#FF5733"
                  value={color}
                  onChange={handleColorChange}
                  disabled={isLoading}
                  maxLength={7}
                  className="font-mono"
                />
                {color && isValidHexColor(color) && (
                  <div
                    className="h-8 w-8 rounded border border-zinc-300 dark:border-zinc-700"
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Enter a hex color code like #FF5733
              </p>
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  useCreateListMutation,
  useUpdateListMutation,
} from '../-utils/tasks-queries'
import { useTasksStore } from '#/stores/tasks-store'
import { isValidHexColor, getNextOrder } from '../-utils/tasks-utils'
import { useToast } from '#/hooks/use-toast'

interface NewListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editListId?: string
}

export function NewListDialog({
  open,
  onOpenChange,
  editListId,
}: NewListDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const createListMutation = useCreateListMutation()
  const updateListMutation = useUpdateListMutation()

  const lists = useTasksStore((s) => s.lists)
  const tasks = useTasksStore((s) => s.tasks)

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
        const nextOrder = getNextOrder([], undefined)
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

  // Initialize form when opening in edit mode
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit List' : 'Create New List'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your list details'
              : 'Add a new task list to organize your tasks'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="flex gap-2 items-center">
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
                  className="w-8 h-8 rounded border border-zinc-300 dark:border-zinc-700"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enter a hex color code like #FF5733
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

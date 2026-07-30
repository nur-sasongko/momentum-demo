import { useEffect, useState } from 'react'
import { DiscardChangesDialog } from '#/components/discard-changes-dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
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
import { useToast } from '#/hooks/use-toast'
import { useUnsavedChangesGuard } from '#/hooks/use-unsaved-changes-guard'
import { cn } from '#/libs/utils'
import type { TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { useCreateTaskMutation } from '../-utils/tasks-queries'
import { getNextOrder } from '../-utils/tasks-utils'

interface AddTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: TaskList[]
  defaultListId?: string
}

export function AddTaskSheet({
  open,
  onOpenChange,
  lists,
  defaultListId,
}: AddTaskSheetProps) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [listId, setListId] = useState(defaultListId || lists[0]?.id || '')
  const [deadline, setDeadline] = useState('')

  const tasks = useTasksStore((s) => s.tasks)
  const createTaskMutation = useCreateTaskMutation()
  const isLoading = createTaskMutation.isPending

  useEffect(() => {
    if (open) {
      setTitle('')
      setNotes('')
      setListId(defaultListId || lists[0]?.id || '')
      setDeadline('')
    }
  }, [open, defaultListId, lists])

  const isDirty = title.trim() !== '' || notes.trim() !== '' || deadline !== ''
  const closeSheet = () => onOpenChange(false)
  const { confirmOpen, setConfirmOpen, requestClose } = useUnsavedChangesGuard(
    isDirty,
    closeSheet,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast({
        variant: 'destructive',
        description: 'Task title is required',
      })
      return
    }

    if (!listId) {
      toast({
        variant: 'destructive',
        description: 'Select a list for this task',
      })
      return
    }

    try {
      await createTaskMutation.mutateAsync({
        title: title.trim(),
        notes: notes.trim() || undefined,
        listId,
        deadline: deadline || undefined,
        starred: false,
        completed: false,
        subtasks: [],
        order: getNextOrder(tasks, listId),
      })
      toast({
        description: 'Task created',
      })
      closeSheet()
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error ? error.message : 'Failed to create task',
      })
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose()
      }}
    >
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(isMobile ? 'h-[90dvh] rounded-t-xl' : 'sm:max-w-md')}
      >
        <SheetHeader>
          <SheetTitle>Add Task</SheetTitle>
          <SheetDescription>
            Create a new task and choose which list it belongs to
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                placeholder="Add details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-list">List</Label>
              <Select
                value={listId}
                onValueChange={setListId}
                disabled={isLoading}
              >
                <SelectTrigger id="task-list">
                  <SelectValue placeholder="Select a list" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-deadline">Deadline (Optional)</Label>
              <Input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>

      <DiscardChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={closeSheet}
        description="You have unsaved changes to this task. Closing now will discard them."
      />
    </Sheet>
  )
}

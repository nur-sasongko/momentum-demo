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
import { Textarea } from '#/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { TaskList } from '#/stores/tasks-store'
import { useTasksStore } from '#/stores/tasks-store'
import { useCreateTaskMutation } from '../-utils/tasks-queries'
import { getNextOrder } from '../-utils/tasks-utils'
import { useToast } from '#/hooks/use-toast'

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lists: TaskList[]
  defaultListId?: string
}

export function AddTaskDialog({
  open,
  onOpenChange,
  lists,
  defaultListId,
}: AddTaskDialogProps) {
  const { toast } = useToast()
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

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

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
      handleOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error ? error.message : 'Failed to create task',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task and choose which list it belongs to
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

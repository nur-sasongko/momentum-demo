import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  HABIT_COLORS,
  HABIT_COLOR_CLASSES,
  HABIT_EMOJIS,
} from '#/lib/habit-utils'
import { cn } from '#/libs/utils'
import { useHabitsStore } from '#/stores/habits-store'

const newHabitSchema = z.object({
  name: z.string().min(1, 'Name is required').max(48),
  icon: z.string().min(1),
  color: z.enum(HABIT_COLORS),
})

type NewHabitForm = z.infer<typeof newHabitSchema>

export function NewHabitModal() {
  const isOpen = useHabitsStore((s) => s.isNewHabitOpen)
  const setNewHabitOpen = useHabitsStore((s) => s.setNewHabitOpen)
  const addHabit = useHabitsStore((s) => s.addHabit)

  const form = useForm<NewHabitForm>({
    resolver: zodResolver(newHabitSchema),
    defaultValues: {
      name: '',
      icon: HABIT_EMOJIS[0],
      color: 'violet',
    },
  })

  const selectedIcon = form.watch('icon')
  const selectedColor = form.watch('color')

  const onSubmit = form.handleSubmit((values) => {
    addHabit(values)
    form.reset({
      name: '',
      icon: HABIT_EMOJIS[0],
      color: 'violet',
    })
  })

  return (
    <Dialog open={isOpen} onOpenChange={setNewHabitOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              placeholder="e.g. Morning run"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => form.setValue('icon', emoji)}
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg border text-lg transition-colors',
                    selectedIcon === emoji
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-secondary hover:bg-accent',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {HABIT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color)}
                  className={cn(
                    'size-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all',
                    HABIT_COLOR_CLASSES[color].dot,
                    selectedColor === color
                      ? HABIT_COLOR_CLASSES[color].ring
                      : 'ring-transparent',
                  )}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewHabitOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create habit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

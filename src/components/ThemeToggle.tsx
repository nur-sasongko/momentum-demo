import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { useTheme } from '#/hooks/use-theme'
import { cn } from '#/libs/utils'

const themeIcons = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
} as const

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, cycleTheme, themeLabels } = useTheme()
  const Icon = themeIcons[theme]

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-9 rounded-full', className)}
      onClick={cycleTheme}
      aria-label={`Theme: ${themeLabels[theme]}. Click to change.`}
    >
      <Icon className="size-4" />
    </Button>
  )
}

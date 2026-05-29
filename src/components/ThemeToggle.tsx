import { Monitor, Moon, Sun } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export const THEME_STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark' | 'auto'

const THEME_CYCLE: Theme[] = ['light', 'dark', 'auto']

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored
    }
  } catch {
    /* ignore */
  }

  return 'dark'
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark', 'auto')

  if (theme === 'auto') {
    root.classList.add('auto')
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    }
    return
  }

  if (theme === 'dark') {
    root.classList.add('dark')
    return
  }

  root.classList.add('light')
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme')||'dark';var r=document.documentElement;r.classList.remove('light','dark','auto');if(t==='auto'){r.classList.add('auto');if(window.matchMedia('(prefers-color-scheme: dark)').matches)r.classList.add('dark');}else if(t==='dark'){r.classList.add('dark');}else{r.classList.add('light');}}catch(e){}})();`

const themeIcons = {
  light: Sun,
  dark: Moon,
  auto: Monitor,
} as const

const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (theme !== 'auto') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const onChange = () => {
      applyTheme('auto')
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next)
    setThemeState(next)
  }, [])

  const cycleTheme = useCallback(() => {
    const index = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(index + 1) % THEME_CYCLE.length] ?? 'light'
    setTheme(next)
  }, [theme, setTheme])

  return { theme, setTheme, cycleTheme, themeLabels }
}

type ThemeToggleProps = {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme()
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

import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark' | 'auto'

const THEME_CYCLE: Theme[] = ['light', 'dark', 'auto']

/** Kept in sync with `--background` in src/styles.css for light and dark. */
const THEME_COLOR_LIGHT = '#faf7f3'
const THEME_COLOR_DARK = '#131417'

function updateThemeColorMeta(isDark: boolean) {
  const color = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', color)
  })
}

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
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      root.classList.add('dark')
    }
    updateThemeColorMeta(isDark)
    return
  }

  if (theme === 'dark') {
    root.classList.add('dark')
    updateThemeColorMeta(true)
    return
  }

  root.classList.add('light')
  updateThemeColorMeta(false)
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme')||'dark';var r=document.documentElement;r.classList.remove('light','dark','auto');var d;if(t==='auto'){r.classList.add('auto');d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)r.classList.add('dark');}else if(t==='dark'){r.classList.add('dark');d=true;}else{r.classList.add('light');d=false;}var c=d?'#131417':'#faf7f3';var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute('content',c);}catch(e){}})();`

export const themeLabels: Record<Theme, string> = {
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

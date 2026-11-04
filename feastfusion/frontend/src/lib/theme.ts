import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'feastfusion.theme'

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Reads whatever the pre-paint script in index.html already decided. */
export function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  if (attr === 'dark' || attr === 'light') return attr
  return readStored() ?? systemTheme()
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  // Colour transitions that start while the tab is throttled can freeze
  // part-way on Android and leave stale colours (black text on dark glass).
  // Swap with transitions off and force the recalculation to commit before
  // they come back, so no interpolation is ever left in flight.
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  // Keep the phone browser chrome in step with the page.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#100E0B' : '#FAF6F0')
  void root.offsetHeight
  root.classList.remove('theme-switching')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Only follow the OS while the visitor has not picked a side themselves.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!readStored()) setTheme(query.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Private mode / storage disabled: the toggle still works for this visit.
      }
      applyTheme(next)
      return next
    })
  }, [])

  return { theme, toggle }
}

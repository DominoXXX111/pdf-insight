export type Theme = 'light' | 'dark'

const KEY = 'pdf-insight:theme'

/** Motyw wybrany recznie; null = zgodnie z ustawieniem systemu. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Ustawia data-theme na <html> - CSS wybiera wtedy tokeny jasne albo ciemne. */
export function applyTheme(theme: Theme | null): void {
  if (theme) document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Tryb prywatny - motyw obowiazuje do zamkniecia karty.
  }
}

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type ThemeId = 'light' | 'dark' | 'navy' | 'warm' | 'forest'

export interface ThemeOption {
  id: ThemeId
  label: string
  description: string
  preview: {
    bg: string
    sidebar: string
    accent: string
    card: string
    text: string
  }
}

export const themes: ThemeOption[] = [
  {
    id: 'light',
    label: 'Klasik Aydınlık',
    description: 'Profesyonel ve sade — varsayılan tema',
    preview: { bg: '#F8FAFC', sidebar: '#0F172A', accent: '#B8860B', card: '#FFFFFF', text: '#0F172A' },
  },
  {
    id: 'dark',
    label: 'Koyu',
    description: 'Göz yorgunluğunu azaltan karanlık tema',
    preview: { bg: '#0B0F19', sidebar: '#0B0F19', accent: '#D4A843', card: '#141926', text: '#E2E8F0' },
  },
  {
    id: 'navy',
    label: 'Gece Mavisi',
    description: 'Derin mavi tonlarıyla profesyonel',
    preview: { bg: '#0F1729', sidebar: '#0A0F1F', accent: '#3B82F6', card: '#162032', text: '#CBD5E1' },
  },
  {
    id: 'warm',
    label: 'Sıcak Krem',
    description: 'Göze yumuşak gelen sıcak tonlar',
    preview: { bg: '#FAF7F2', sidebar: '#2C1810', accent: '#B8860B', card: '#FFFFFF', text: '#3D2914' },
  },
  {
    id: 'forest',
    label: 'Orman',
    description: 'Doğal yeşil tonlarıyla huzurlu',
    preview: { bg: '#F2F7F4', sidebar: '#0F1F15', accent: '#2D7A4F', card: '#FFFFFF', text: '#1A3326' },
  },
]

const STORAGE_KEY = 'hukuk-takip-theme'

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (t: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    return stored && themes.some((t) => t.id === stored) ? stored : 'light'
  })

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    // Remove all theme classes
    themes.forEach((t) => root.classList.remove(`theme-${t.id}`))
    // Add current
    root.classList.add(`theme-${theme}`)
    // Toggle dark class for tailwind darkMode
    if (theme === 'dark' || theme === 'navy') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

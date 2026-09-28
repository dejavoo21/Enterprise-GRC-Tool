/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode =
  | 'light'
  | 'dark'
  | 'midnight'
  | 'ocean'
  | 'forest'
  | 'sepia'
  | 'high-contrast'
  | 'system';

export interface ShellThemeOption {
  value: ThemeMode;
  label: string;
  description: string;
  swatches: readonly [string, string, string];
}

export const SHELL_THEME_OPTIONS: ShellThemeOption[] = [
  { value: 'light', label: 'Light', description: 'Clean and modern', swatches: ['#f3f6fb', '#ffffff', '#3056d3'] },
  { value: 'dark', label: 'Dark', description: 'Reduce eye strain', swatches: ['#0b1220', '#111a29', '#7ea2ff'] },
  { value: 'midnight', label: 'Midnight', description: 'Deep desk experience', swatches: ['#040814', '#0d172a', '#8aa4ff'] },
  { value: 'ocean', label: 'Ocean', description: 'Cool and calm', swatches: ['#eef7fb', '#ffffff', '#1472ff'] },
  { value: 'forest', label: 'Forest', description: 'Natural and fresh', swatches: ['#f2f7f1', '#ffffff', '#1f7a46'] },
  { value: 'sepia', label: 'Sepia', description: 'Warm and classic', swatches: ['#f8f1e7', '#fffaf3', '#925f2d'] },
  { value: 'high-contrast', label: 'High Contrast', description: 'Maximum readability', swatches: ['#ffffff', '#0f172a', '#0057ff'] },
  { value: 'system', label: 'Auto', description: 'Follow system preference', swatches: ['#f3f6fb', '#0b1220', '#3056d3'] },
];

type ResolvedTheme = Exclude<ThemeMode, 'system'>;
type ShellPanel = 'search' | 'notifications' | 'quickActions' | 'activity' | null;

interface ShellContextValue {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  activePanel: ShellPanel;
  openPanel: (panel: Exclude<ShellPanel, null>) => void;
  closePanel: () => void;
  togglePanel: (panel: Exclude<ShellPanel, null>) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  registerSearch: (query: string) => void;
}

const STORAGE_KEYS = {
  theme: 'laflo-theme-preference',
  legacyTheme: 'shellThemeMode',
  recentSearches: 'shellRecentSearches',
};

const ShellContext = createContext<ShellContextValue | null>(null);

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme) || window.localStorage.getItem(STORAGE_KEYS.legacyTheme);
  return SHELL_THEME_OPTIONS.some((option) => option.value === saved) ? (saved as ThemeMode) : 'system';
}

function getStoredSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.recentSearches);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  ));
  const [activePanel, setActivePanel] = useState<ShellPanel>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getStoredSearches);
  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themeMode = themeMode;
    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);
    window.localStorage.removeItem(STORAGE_KEYS.legacyTheme);

    if (themeMode !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(recentSearches));
  }, [recentSearches]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const cycleThemeMode = () => {
    const currentIndex = SHELL_THEME_OPTIONS.findIndex((option) => option.value === themeMode);
    const nextOption = SHELL_THEME_OPTIONS[(currentIndex + 1) % SHELL_THEME_OPTIONS.length];
    setThemeModeState(nextOption.value);
  };

  const openPanel = (panel: Exclude<ShellPanel, null>) => setActivePanel(panel);
  const closePanel = () => setActivePanel(null);
  const togglePanel = (panel: Exclude<ShellPanel, null>) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const registerSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;
    setRecentSearches((current) => [normalized, ...current.filter((item) => item !== normalized)].slice(0, 6));
  };

  return (
    <ShellContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        setThemeMode,
        cycleThemeMode,
        activePanel,
        openPanel,
        closePanel,
        togglePanel,
        searchQuery,
        setSearchQuery,
        recentSearches,
        registerSearch,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
}

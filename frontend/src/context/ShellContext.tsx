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
}

export const SHELL_THEME_OPTIONS: ShellThemeOption[] = [
  { value: 'light', label: 'Light', description: 'Clean and modern' },
  { value: 'dark', label: 'Dark', description: 'Reduce eye strain' },
  { value: 'midnight', label: 'Midnight', description: 'Deep desk experience' },
  { value: 'ocean', label: 'Ocean', description: 'Cool and calm' },
  { value: 'forest', label: 'Forest', description: 'Natural and fresh' },
  { value: 'sepia', label: 'Sepia', description: 'Warm and classic' },
  { value: 'high-contrast', label: 'High Contrast', description: 'Maximum readability' },
  { value: 'system', label: 'Auto', description: 'Follow system preference' },
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
  theme: 'shellThemeMode',
  recentSearches: 'shellRecentSearches',
};

const ShellContext = createContext<ShellContextValue | null>(null);

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const saved = window.localStorage.getItem(STORAGE_KEYS.theme);
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

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredThemeMode()));
  const [activePanel, setActivePanel] = useState<ShellPanel>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getStoredSearches);

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(themeMode);
    setResolvedTheme(nextResolvedTheme);
    document.documentElement.dataset.theme = nextResolvedTheme;
    document.documentElement.dataset.themeMode = themeMode;
    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);

    if (themeMode !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const updated = resolveTheme('system');
      setResolvedTheme(updated);
      document.documentElement.dataset.theme = updated;
      document.documentElement.dataset.themeMode = 'system';
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, [themeMode]);

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

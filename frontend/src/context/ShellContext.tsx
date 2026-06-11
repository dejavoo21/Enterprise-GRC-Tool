import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ShellPanel = 'search' | 'notifications' | 'quickActions' | 'activity' | null;

interface ShellContextValue {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
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
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
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

function resolveTheme(mode: ThemeMode) {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getStoredThemeMode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getStoredThemeMode()));
  const [activePanel, setActivePanel] = useState<ShellPanel>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(getStoredSearches);

  useEffect(() => {
    const nextResolvedTheme = resolveTheme(themeMode);
    setResolvedTheme(nextResolvedTheme);
    document.documentElement.dataset.theme = nextResolvedTheme;
    window.localStorage.setItem(STORAGE_KEYS.theme, themeMode);

    if (themeMode !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const updated = resolveTheme('system');
      setResolvedTheme(updated);
      document.documentElement.dataset.theme = updated;
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
    setThemeModeState((current) => (current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light'));
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

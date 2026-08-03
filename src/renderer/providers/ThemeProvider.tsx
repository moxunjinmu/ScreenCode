import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'screencode-theme';
const DARK_THEME_QUERY = '(prefers-color-scheme: dark)';
const ThemeContext = createContext<ThemeContextValue | null>(null);

const getSystemTheme = (): Theme =>
  window.matchMedia(DARK_THEME_QUERY).matches ? 'dark' : 'light';

const getStoredTheme = (): Theme | null => {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
  } catch {
    return null;
  }
};

/**
 * 全局主题入口：手动选择优先；没有手动选择时跟随系统主题。
 * 组件只读取 Context，不直接访问存储或操作根节点。
 */
export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [manualTheme, setManualTheme] = useState<Theme | null>(getStoredTheme);
  const [theme, setThemeState] = useState<Theme>(() => manualTheme ?? getSystemTheme());

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (manualTheme) return undefined;

    const mediaQuery = window.matchMedia(DARK_THEME_QUERY);
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [manualTheme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setManualTheme(nextTheme);
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // 存储不可用时仍保留当前会话的主题选择。
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const contextValue = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 ThemeProvider 内使用');
  }
  return context;
};

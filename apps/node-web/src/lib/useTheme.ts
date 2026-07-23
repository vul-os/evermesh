import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Distinct storage key from `apps/gateway/web`'s `evermesh:theme` — this
 *  is a separate app with its own preference, not a shared setting. */
const STORAGE_KEY = "evermesh-node:theme";

export function resolveInitialTheme(storage: Pick<Storage, "getItem">, prefersDark: boolean): Theme {
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return prefersDark ? "dark" : "light";
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Dark-mode toggle, persisted to localStorage with a
 * `prefers-color-scheme` default — mirrors
 * `apps/gateway/web/src/hooks/useTheme.ts` (`index.html`'s inline script
 * applies the same resolution synchronously before paint).
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return resolveInitialTheme(window.localStorage, window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage unavailable (private browsing, quota) — theme just won't persist.
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => toggleTheme(t)), []);

  return { theme, setTheme, toggle };
}

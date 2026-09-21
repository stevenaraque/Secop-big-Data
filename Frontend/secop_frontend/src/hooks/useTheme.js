import { useCallback, useEffect, useState } from "react";

const KEY = "secop-theme";

// Hook tema claro/oscuro. Qué: .dark en <html> + persistido. Por qué: toggle global sin FOUC con CSP (sin script inline).
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  // Sincroniza instancias (varias páginas montan su propio toggle)
  useEffect(() => {
    const sync = (e) => {
      const next = e?.detail;
      if (next === "dark" || next === "light") setTheme(next);
    };
    window.addEventListener("secop-theme-changed", sync);
    return () => window.removeEventListener("secop-theme-changed", sync);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.dispatchEvent(new CustomEvent("secop-theme-changed", { detail: next }));
  }, [theme]);

  return { theme, toggle, dark: theme === "dark" };
}

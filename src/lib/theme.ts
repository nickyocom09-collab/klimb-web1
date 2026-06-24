import type { ThemePref } from "./constants";

const STORAGE_KEY = "klimb-theme";

/** Apply a theme to <html> and remember it for next boot. */
export function applyTheme(theme: ThemePref) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

/** Last-used theme from storage, defaulting to dark. Used before profile loads
 *  to avoid a flash of the wrong theme. */
export function bootTheme(): ThemePref {
  let theme: ThemePref = "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    // ignore
  }
  document.documentElement.dataset.theme = theme;
  return theme;
}

import type { ThemePref } from "./constants";

const STORAGE_KEY = "klimb-theme";

// Match --c-bg in index.css for each theme. Used for the iOS status-bar /
// safe-area colour so it never flashes the opposite theme when switching.
const BG_COLOR: Record<ThemePref, string> = {
  dark: "#0a0a0b",
  light: "#ffffff",
};

/** Keep the <meta name="theme-color"> in sync with the active theme so the
 *  notch / status-bar strip repaints to the right colour immediately instead
 *  of leaving a bar of the previous theme at the top. */
function syncThemeColor(theme: ThemePref) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BG_COLOR[theme]);
}

/** Apply a theme to <html> and remember it for next boot. */
export function applyTheme(theme: ThemePref) {
  document.documentElement.dataset.theme = theme;
  syncThemeColor(theme);
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
  syncThemeColor(theme);
  return theme;
}

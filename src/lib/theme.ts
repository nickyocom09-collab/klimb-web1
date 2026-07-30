import { Capacitor, registerPlugin } from "@capacitor/core";
import type { ThemePref } from "./constants";

const STORAGE_KEY = "klimb-theme";

// Match --c-bg in index.css for each theme. Used for the iOS status-bar /
// safe-area colour so it never flashes the opposite theme when switching.
const BG_COLOR: Record<ThemePref, string> = {
  dark: "#1c1c1e",
  light: "#ffffff",
};

interface ThemeAppearancePlugin {
  setTheme(options: { theme: ThemePref }): Promise<void>;
}

const ThemeAppearance =
  registerPlugin<ThemeAppearancePlugin>("ThemeAppearance");

/** Keep the <meta name="theme-color"> in sync with the active theme so the
 *  notch / status-bar strip repaints to the right colour immediately instead
 *  of leaving a bar of the previous theme at the top. */
function syncThemeColor(theme: ThemePref) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BG_COLOR[theme]);
}

function syncNativeTheme(theme: ThemePref) {
  if (!Capacitor.isNativePlatform()) return;
  void ThemeAppearance.setTheme({ theme }).catch(() => {
    // Older builds do not have the bridge yet; the web theme still works.
  });
}

/** Apply a theme to <html> and remember it for next boot. */
export function applyTheme(theme: ThemePref) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  syncThemeColor(theme);
  syncNativeTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

/** Last-used theme from storage. A fresh install follows the device appearance
 *  so the native launch screen and the first web frame use the same colors. */
export function bootTheme(): ThemePref {
  let theme: ThemePref = window.matchMedia("(prefers-color-scheme: light)")
    .matches
    ? "light"
    : "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {
    // ignore
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  syncThemeColor(theme);
  syncNativeTheme(theme);
  return theme;
}

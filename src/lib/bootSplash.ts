import { Capacitor, registerPlugin } from "@capacitor/core";

interface LaunchOverlayPlugin {
  dismiss(): Promise<void>;
}

const LaunchOverlay = registerPlugin<LaunchOverlayPlugin>("LaunchOverlay");

/**
 * The pre-JS splash in index.html lives outside #root, so React's first paint
 * happens *underneath* it. We hold it until the app is genuinely ready (auth
 * resolved), then crossfade it out exactly once.
 *
 * Holding it matters: dismissing on mount revealed React's own <Splash />
 * first, so the launch was splash -> splash -> app with a visible step between
 * each. Now there is a single dissolve straight into the finished UI.
 */
let dismissed = false;

export function dismissBootSplash() {
  if (dismissed) return;
  const boot = document.getElementById("boot-splash");
  if (!boot) {
    dismissed = true;
    dismissNativeOverlayAfterPaint();
    return;
  }
  dismissed = true;

  // On iOS, a native overlay is still holding the exact launch artwork above
  // WKWebView. Remove the hidden HTML copy first, let the finished app paint,
  // then remove the native layer without animation. The visible K therefore
  // stays fully opaque until the real screen replaces it in a single frame.
  if (Capacitor.isNativePlatform()) {
    boot.remove();
    dismissNativeOverlayAfterPaint();
    return;
  }

  // Two frames so the app's first real paint has actually landed underneath
  // before we start fading — otherwise the fade can reveal a blank frame.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      boot.classList.add("is-hiding");
      const done = () => boot.remove();
      boot.addEventListener("transitionend", done, { once: true });
      // Safety net in case the transition never fires (reduced motion, etc.).
      setTimeout(done, 1200);
    }),
  );
}

function dismissNativeOverlayAfterPaint() {
  if (!Capacitor.isNativePlatform()) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      void LaunchOverlay.dismiss().catch(() => {
        // Older installed builds do not expose the native overlay plugin.
      });
    }),
  );
}

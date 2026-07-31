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
    return;
  }
  dismissed = true;
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

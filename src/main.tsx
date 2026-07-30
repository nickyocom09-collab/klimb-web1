import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { bootTheme } from "./lib/theme";

// Apply the last-used theme before first paint to avoid a flash.
bootTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

/**
 * Hand the pre-JS splash over to React without a visible seam.
 *
 * The boot splash lives outside #root, so React's first paint happens
 * underneath it. We wait two frames (so that paint has actually landed), then
 * crossfade the boot splash out. Underneath is either React's identical
 * <Splash /> — making the fade invisible — or the app itself, which dissolves
 * in. Either way there is never a hard cut.
 */
function dismissBootSplash() {
  const boot = document.getElementById("boot-splash");
  if (!boot) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      boot.classList.add("is-hiding");
      const done = () => boot.remove();
      boot.addEventListener("transitionend", done, { once: true });
      // Safety net if the transition never fires (reduced motion, etc.).
      setTimeout(done, 900);
    }),
  );
}

dismissBootSplash();

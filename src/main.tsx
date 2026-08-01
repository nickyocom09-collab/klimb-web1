import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { EntitlementProvider } from "./lib/entitlements";
import { bootTheme } from "./lib/theme";

// Apply the last-used theme before first paint to avoid a flash.
bootTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EntitlementProvider>
          <App />
        </EntitlementProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// The boot splash is dismissed by App once auth has resolved (see
// dismissBootSplash in lib/bootSplash.ts), so the launch is a single
// crossfade straight into the finished UI rather than splash -> splash -> app.

import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { IntroTutorial, INTRO_SEEN_KEY } from "./IntroTutorial";
import { BarChart3, BookOpen, MapPin, Plus, User } from "lucide-react";

function introAlreadySeenLocally(): boolean {
  try {
    return !!localStorage.getItem(INTRO_SEEN_KEY);
  } catch {
    return false;
  }
}

// Logbook-first IA: your history is the front door, the map is where you climb
// (and collect gyms), and the center Log button is the hero — fast logging is
// the app's main loop.
const tabs = [
  { to: "/", label: "Logbook", Icon: BookOpen, end: true, hero: false },
  { to: "/map", label: "Map", Icon: MapPin, end: false, hero: false },
  { to: "/log", label: "Log", Icon: Plus, end: false, hero: true },
  { to: "/stats", label: "Stats", Icon: BarChart3, end: false, hero: false },
  { to: "/profile", label: "Profile", Icon: User, end: false, hero: false },
];

export function Layout() {
  const { profile } = useAuth();
  // First launch only: a quick "how Klimb works" carousel. The seen_intro
  // flag lives on the profile so it never reappears, on any device. We also
  // skip it if it already played locally before sign-up (guest tutorial), so a
  // brand-new user who just watched it during onboarding doesn't see it twice.
  const showIntro =
    !!profile &&
    profile.onboarded &&
    !profile.seen_intro &&
    !introAlreadySeenLocally();

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {showIntro ? <IntroTutorial /> : null}
      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-app px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {/* Liquid-glass hot bar: translucent, heavy blur + saturation, with a
            soft top highlight so it reads like frosted glass floating over the
            content. */}
        <div className="relative flex items-center justify-between gap-1 overflow-hidden rounded-full border border-white/10 bg-surface/50 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
          {tabs.map(({ to, label, Icon, end, hero }) =>
            hero ? (
              <NavLink
                key={to}
                to={to}
                end={end}
                aria-label={label}
                className="flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold"
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg shadow-lg ring-4 ring-surface transition-transform ${
                        isActive ? "scale-105" : ""
                      }`}
                    >
                      <Icon size={26} strokeWidth={2.6} />
                    </span>
                    <span className="text-accent">{label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 rounded-full py-1.5 text-[11px] font-semibold transition ${
                    isActive
                      ? "bg-surface-2 text-accent"
                      : "text-faint hover:text-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.4 : 2}
                      className={`transition-transform ${isActive ? "scale-105" : ""}`}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}

export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-bg/95 px-5 py-4 backdrop-blur">
      <div>
        {subtitle ? (
          <p className="text-xs text-muted">{subtitle}</p>
        ) : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-chalk">
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}

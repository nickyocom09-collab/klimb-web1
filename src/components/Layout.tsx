import { NavLink, Outlet } from "react-router-dom";
import { Home, Map, Plus, Trophy, User } from "lucide-react";

// The center tab (Log) is the hero — fast logging is the app's main loop.
const tabs = [
  { to: "/", label: "Home", Icon: Home, end: true, hero: false },
  { to: "/map", label: "Map", Icon: Map, end: false, hero: false },
  { to: "/log", label: "Log", Icon: Plus, end: false, hero: true },
  { to: "/sends", label: "Sends", Icon: Trophy, end: false, hero: false },
  { to: "/profile", label: "Profile", Icon: User, end: false, hero: false },
];

export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-app px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-between gap-1 rounded-full border border-border bg-surface/95 px-2 py-2 shadow-lg backdrop-blur">
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
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/95 px-5 py-4 backdrop-blur">
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

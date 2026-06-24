import { NavLink, Outlet } from "react-router-dom";
import { Activity, Building2, Home, PlusCircle, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Home", Icon: Home, end: true },
  { to: "/gyms", label: "Gyms", Icon: Building2, end: false },
  { to: "/add", label: "Add", Icon: PlusCircle, end: false },
  { to: "/activity", label: "Activity", Icon: Activity, end: false },
  { to: "/profile", label: "Profile", Icon: User, end: false },
];

export function Layout() {
  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-app border-t border-border bg-surface/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {tabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-2.5 text-xs transition ${
                  isActive ? "text-accent" : "text-faint hover:text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                  ) : null}
                  <Icon
                    size={22}
                    className={`transition-transform ${isActive ? "scale-110" : ""}`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
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

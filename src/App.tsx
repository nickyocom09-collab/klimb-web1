import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { setupDeepLinks } from "./lib/deeplink";
import { Splash } from "./components/Splash";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { GymSelect } from "./pages/GymSelect";
import { LogClimb } from "./pages/LogClimb";
import { RouteDetail } from "./pages/RouteDetail";
import { PublicProfile } from "./pages/PublicProfile";
import { Notifications } from "./pages/Notifications";
import { Onboarding } from "./pages/Onboarding";
import { Sends } from "./pages/Sends";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Gyms } from "./pages/Gyms";
import { Glossary } from "./pages/Glossary";
import { Stats } from "./pages/Stats";
import { ProjectDetail } from "./pages/ProjectDetail";
import { FullLogbook } from "./pages/FullLogbook";
import { Passport } from "./pages/Passport";
import { Privacy } from "./pages/Privacy";
import { Support } from "./pages/Support";

// The 3D globe pulls in three.js — keep it out of the main bundle so the
// feed loads fast; the globe chunk streams in when the Map tab is opened.
const GymMap = lazy(() =>
  import("./pages/GymMap").then((m) => ({ default: m.GymMap })),
);
// Friends pulls in the QR-code library — most sessions never open it.
const Friends = lazy(() =>
  import("./pages/Friends").then((m) => ({ default: m.Friends })),
);

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarded({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <Splash />;
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireGym({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <Splash />;
  if (profile && !profile.home_gym_id)
    return <Navigate to="/gym/select" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const navigate = useNavigate();

  // Catches klimb:// links (email confirmation, password reset, OAuth
  // return) so they hand the session to Supabase and route in-app instead
  // of bouncing to Safari, which can't open a native scheme/localhost link.
  useEffect(() => {
    setupDeepLinks((path) => navigate(path, { replace: true }));
  }, [navigate]);

  return (
    <Routes>
      {/* Public — reachable in-app and as an App Store privacy URL. */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/support" element={<Support />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnly>
            <Signup />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPassword />
          </PublicOnly>
        }
      />
      {/* Reached via the recovery email link — Supabase sets a session, so this
          must stay accessible even when signed in. */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/gym/select"
        element={
          <RequireAuth>
            <GymSelect />
          </RequireAuth>
        }
      />
      <Route
        path="/route/:id"
        element={
          <RequireAuth>
            <RouteDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/project/:routeId"
        element={
          <RequireAuth>
            <ProjectDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/notifications"
        element={
          <RequireAuth>
            <Notifications />
          </RequireAuth>
        }
      />
      <Route
        path="/u/:id"
        element={
          <RequireAuth>
            <PublicProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/friends"
        element={
          <RequireAuth>
            <Suspense fallback={<div className="h-full bg-bg" />}>
              <Friends />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/terms"
        element={
          <RequireAuth>
            <Glossary />
          </RequireAuth>
        }
      />
      <Route
        path="/logbook"
        element={
          <RequireAuth>
            <FullLogbook />
          </RequireAuth>
        }
      />
      <Route
        path="/passport"
        element={
          <RequireAuth>
            <Passport />
          </RequireAuth>
        }
      />
      <Route
        path="/u/:id/passport"
        element={
          <RequireAuth>
            <Passport />
          </RequireAuth>
        }
      />

      <Route
        element={
          <RequireAuth>
            <RequireOnboarded>
              <RequireGym>
                <Layout />
              </RequireGym>
            </RequireOnboarded>
          </RequireAuth>
        }
      >
        {/* Logbook-first: your history is the home tab. */}
        <Route path="/" element={<Sends />} />
        {/* Community route-feed retired — this is an individual logbook now. */}
        <Route path="/gym" element={<Navigate to="/" replace />} />
        <Route path="/stats" element={<Stats />} />
        <Route
          path="/map"
          element={
            <Suspense fallback={<div className="h-full bg-bg" />}>
              <GymMap />
            </Suspense>
          }
        />
        <Route path="/gyms" element={<Gyms />} />
        <Route path="/log" element={<LogClimb />} />
        {/* Adding a route IS logging now — one flow. */}
        <Route path="/add" element={<Navigate to="/log" replace />} />
        <Route path="/activity" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Profile />} />
        {/* Old bookmark-able paths keep working. */}
        <Route path="/sends" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

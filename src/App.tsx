import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Splash } from "./components/Splash";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { GymSelect } from "./pages/GymSelect";
import { Feed } from "./pages/Feed";
import { AddRoute } from "./pages/AddRoute";
import { LogClimb } from "./pages/LogClimb";
import { RouteDetail } from "./pages/RouteDetail";
import { PublicProfile } from "./pages/PublicProfile";
import { Friends } from "./pages/Friends";
import { Notifications } from "./pages/Notifications";
import { Onboarding } from "./pages/Onboarding";
import { Sends } from "./pages/Sends";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Gyms } from "./pages/Gyms";
import { Glossary } from "./pages/Glossary";

// The 3D globe pulls in three.js — keep it out of the main bundle so the
// feed loads fast; the globe chunk streams in when the Map tab is opened.
const GymMap = lazy(() =>
  import("./pages/GymMap").then((m) => ({ default: m.GymMap })),
);
import { ActivityFeed } from "./pages/Activity";

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
  return (
    <Routes>
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
            <Friends />
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
        <Route path="/" element={<Feed />} />
        <Route
          path="/map"
          element={
            <Suspense fallback={<Splash />}>
              <GymMap />
            </Suspense>
          }
        />
        <Route path="/gyms" element={<Gyms />} />
        <Route path="/log" element={<LogClimb />} />
        <Route path="/add" element={<AddRoute />} />
        <Route path="/activity" element={<ActivityFeed />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sends" element={<Sends />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

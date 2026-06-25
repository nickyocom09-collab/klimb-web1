import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { CenterSpinner } from "./components/ui";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { GymSelect } from "./pages/GymSelect";
import { GymAdd } from "./pages/GymAdd";
import { Feed } from "./pages/Feed";
import { AddRoute } from "./pages/AddRoute";
import { RouteDetail } from "./pages/RouteDetail";
import { Notifications } from "./pages/Notifications";
import { Onboarding } from "./pages/Onboarding";
import { MySends } from "./pages/MySends";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Gyms } from "./pages/Gyms";
import { GymMap } from "./pages/GymMap";
import { ActivityFeed } from "./pages/Activity";

function FullScreen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      {children}
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <FullScreen>
        <CenterSpinner />
      </FullScreen>
    );
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarded({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading)
    return (
      <FullScreen>
        <CenterSpinner />
      </FullScreen>
    );
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireGym({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading)
    return (
      <FullScreen>
        <CenterSpinner />
      </FullScreen>
    );
  if (profile && !profile.home_gym_id)
    return <Navigate to="/gym/select" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <FullScreen>
        <CenterSpinner />
      </FullScreen>
    );
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
        path="/gym/add"
        element={
          <RequireAuth>
            <GymAdd />
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
        <Route path="/map" element={<GymMap />} />
        <Route path="/gyms" element={<Gyms />} />
        <Route path="/add" element={<AddRoute />} />
        <Route path="/activity" element={<ActivityFeed />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/sends" element={<MySends />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { useAuth } from "./lib/auth";
import {
  friendRequestPath,
  PENDING_PROFILE_KEY,
  setupDeepLinks,
} from "./lib/deeplink";
import { dismissBootSplash } from "./lib/bootSplash";
import { Splash } from "./components/Splash";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { GuestHome } from "./pages/GuestHome";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { Support } from "./pages/Support";
import { ThirdPartyNotices } from "./pages/ThirdPartyNotices";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { useEntitlements } from "./lib/entitlements";
import { ProOfferSheet } from "./components/ProOfferSheet";

// Keep signed-in routes out of the launch bundle. Auth and the welcome screen
// stay immediate; feature code streams in only when that destination opens.
const GymSelect = lazy(() =>
  import("./pages/GymSelect").then((m) => ({ default: m.GymSelect })),
);
const LogClimb = lazy(() =>
  import("./pages/LogClimb").then((m) => ({ default: m.LogClimb })),
);
const RouteDetail = lazy(() =>
  import("./pages/RouteDetail").then((m) => ({ default: m.RouteDetail })),
);
const PublicProfile = lazy(() =>
  import("./pages/PublicProfile").then((m) => ({ default: m.PublicProfile })),
);
const Notifications = lazy(() =>
  import("./pages/Notifications").then((m) => ({ default: m.Notifications })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })),
);
const Sends = lazy(() =>
  import("./pages/Sends").then((m) => ({ default: m.Sends })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then((m) => ({ default: m.Profile })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Gyms = lazy(() =>
  import("./pages/Gyms").then((m) => ({ default: m.Gyms })),
);
const Glossary = lazy(() =>
  import("./pages/Glossary").then((m) => ({ default: m.Glossary })),
);
const Stats = lazy(() =>
  import("./pages/Stats").then((m) => ({ default: m.Stats })),
);
const ProjectDetail = lazy(() =>
  import("./pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail })),
);
const FullLogbook = lazy(() =>
  import("./pages/FullLogbook").then((m) => ({ default: m.FullLogbook })),
);
const Passport = lazy(() =>
  import("./pages/Passport").then((m) => ({ default: m.Passport })),
);
const GymMap = lazy(() =>
  import("./pages/GymMap").then((m) => ({ default: m.GymMap })),
);
const FriendsFeed = lazy(() =>
  import("./pages/FriendsFeed").then((m) => ({ default: m.FriendsFeed })),
);
// Friend management pulls in the QR-code library — most sessions never open it.
const FriendsManage = lazy(() =>
  import("./pages/Friends").then((m) => ({ default: m.Friends })),
);
const CustomizeLogbook = lazy(() =>
  import("./pages/CustomizeLogbook").then((m) => ({ default: m.CustomizeLogbook })),
);
const VideoLibrary = lazy(() =>
  import("./pages/VideoLibrary").then((m) => ({ default: m.VideoLibrary })),
);
const Upgrade = lazy(() =>
  import("./pages/Upgrade").then((m) => ({ default: m.Upgrade })),
);
const ProTrial = lazy(() =>
  import("./pages/ProTrial").then((m) => ({ default: m.ProTrial })),
);
const ProUnlocked = lazy(() =>
  import("./components/ProUnlocked").then((m) => ({ default: m.ProUnlocked })),
);

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  // First launch plays the walkthrough; returning signed-out users go straight
  // to login. GuestHome owns that one-time routing decision.
  if (!session) return <Navigate to="/welcome" replace />;
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
  // A gym-less user is normally bounced to the picker — unless they chose
  // off-grid mode, in which case they log to a personal logbook with no home
  // gym until their gym is added and they transfer their climbs over.
  if (profile && !profile.home_gym_id && !profile.offgrid_gym_label)
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
  const { loading: authLoading, session } = useAuth();
  const { unlockCelebration, dismissUnlockCelebration } = useEntitlements();

  // Hold the launch splash until auth has resolved, then crossfade it out once
  // — straight into the finished UI, with no intermediate splash step.
  useEffect(() => {
    if (!authLoading) dismissBootSplash();
  }, [authLoading]);

  // Catches klimb:// links (email confirmation, password reset, OAuth
  // return) so they hand the session to Supabase and route in-app instead
  // of bouncing to Safari, which can't open a native scheme/localhost link.
  useEffect(() => {
    return setupDeepLinks((path) => navigate(path, { replace: true }));
  }, [navigate]);

  // If a signed-out recipient opened a friend invite, finish routing to that
  // profile immediately after they sign in instead of losing the invite.
  useEffect(() => {
    if (authLoading || !session) return;
    const profileId = localStorage.getItem(PENDING_PROFILE_KEY);
    if (!profileId) return;
    const path = friendRequestPath(profileId);
    if (!path) {
      localStorage.removeItem(PENDING_PROFILE_KEY);
      return;
    }
    localStorage.removeItem(PENDING_PROFILE_KEY);
    navigate(path, { replace: true });
  }, [authLoading, navigate, session]);

  return (
    <>
      <ConnectionBanner />
      <Suspense fallback={<Splash />}>
        <Routes>
      {/* Public — reachable in-app and as an App Store privacy URL. */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/support" element={<Support />} />
      <Route path="/open-source" element={<ThirdPartyNotices />} />
      <Route
        path="/welcome"
        element={
          <PublicOnly>
            <GuestHome />
          </PublicOnly>
        }
      />
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
        path="/settings/logbook"
        element={<RequireAuth><CustomizeLogbook /></RequireAuth>}
      />
      <Route
        path="/videos"
        element={<RequireAuth><VideoLibrary /></RequireAuth>}
      />
      <Route
        path="/upgrade"
        element={<RequireAuth><Upgrade /></RequireAuth>}
      />
      <Route
        path="/upgrade/trial"
        element={<RequireAuth><ProTrial /></RequireAuth>}
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
              <FriendsFeed />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/friends/manage"
        element={
          <RequireAuth>
            <Suspense fallback={<div className="h-full bg-bg" />}>
              <FriendsManage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/glossary"
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
      </Suspense>
      <ProOfferSheet />
      {unlockCelebration ? (
        <Suspense fallback={null}>
          <ProUnlocked
            celebration={unlockCelebration}
            onStart={() => {
              dismissUnlockCelebration();
              navigate("/", { replace: true });
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

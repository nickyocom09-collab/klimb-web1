import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  NotebookPen,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { DAY_MS } from "../lib/logstats";
import { Button, CenterSpinner } from "../components/ui";
import { LogSheet, type LogOutcome } from "../components/LogSheet";
import { Stars } from "../components/Stars";

// A project's home: the route, your history with it, and — the heart of it —
// a private running journal. Notes are owner-only (RLS) and survive the send:
// when you finally top it, the project graduates to your logbook but this
// page (and its notes) stay reachable from the route.
export function ProjectDetail() {
  const { routeId } = useParams<{ routeId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [route, setRoute] = useState<RouteWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [since, setSince] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [myStars, setMyStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!routeId || !profile) return;
    setLoading(true);
    const [r, { data: bm }, { data: send }, { data: grade }, { data: rating }, { data: pn }] =
      await Promise.all([
        fetchRoute(routeId),
        supabase
          .from("bookmarks")
          .select("created_at")
          .eq("user_id", profile.id)
          .eq("route_id", routeId)
          .eq("kind", "project")
          .maybeSingle(),
        supabase
          .from("sends")
          .select("send_type, attempts")
          .eq("user_id", profile.id)
          .eq("route_id", routeId)
          .maybeSingle(),
        supabase
          .from("grades")
          .select("grade")
          .eq("user_id", profile.id)
          .eq("route_id", routeId)
          .maybeSingle(),
        supabase
          .from("route_ratings")
          .select("stars")
          .eq("user_id", profile.id)
          .eq("route_id", routeId)
          .maybeSingle(),
        supabase
          .from("project_notes")
          .select("body, updated_at")
          .eq("user_id", profile.id)
          .eq("route_id", routeId)
          .maybeSingle(),
      ]);
    setRoute(r);
    setSince(bm?.created_at ?? null);
    setAttempts(send?.attempts ?? null);
    setSent(!!send && send.send_type !== "attempt");
    setMyGrade(grade?.grade ?? null);
    setMyStars(rating?.stars ?? null);
    setNote(pn?.body ?? "");
    setSavedNote(pn?.body ?? "");
    setNoteUpdatedAt(pn?.updated_at ?? null);
    setLoading(false);
  }, [routeId, profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveNote() {
    if (!routeId || !profile) return;
    setSavingNote(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("project_notes").upsert(
      {
        user_id: profile.id,
        route_id: routeId,
        body: note,
        updated_at: now,
      },
      { onConflict: "user_id,route_id" },
    );
    setSavingNote(false);
    if (!error) {
      setSavedNote(note);
      setNoteUpdatedAt(now);
    } else {
      window.alert(error.message);
    }
  }

  function onLogged(outcome: LogOutcome) {
    setLogOpen(false);
    if (outcome === "flash" || outcome === "send") {
      // Sent! The project graduates to the logbook; notes stay saved.
      navigate(`/route/${routeId}`, { replace: true });
      return;
    }
    load();
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
        <CenterSpinner />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col items-center justify-center gap-4 bg-bg px-8">
        <p className="text-faint">Route not found.</p>
        <Button onClick={() => navigate("/")}>Back to logbook</Button>
      </div>
    );
  }

  const fmt = (g: number | null | undefined) =>
    formatGradeStyled(g, route.climbing_type, system, route.gradingStyle);
  const grade = communityGrade(route.gradeValues);
  const daysOpen = since
    ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS))
    : null;

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {/* Hero photo */}
      <div className="relative">
        <img
          src={route.photo_url}
          alt={`${route.hold_color} route on ${route.wall_section}`}
          className="aspect-[16/10] w-full object-cover"
        />
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-bg/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-accent backdrop-blur">
          <Bookmark size={12} /> Project
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28 pt-4">
        <div className="flex flex-col gap-4">
          {/* Identity + grades */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              <div>
                <p className="text-lg font-bold text-chalk">{route.hold_color}</p>
                <p className="text-sm text-muted">
                  {route.wall_section} · {climbTypeLabel(route.climbing_type)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold leading-none tabular-nums text-accent">
                {fmt(grade)}
              </p>
              <p className="mt-1 text-xs text-faint">
                {myGrade !== null ? `felt ${fmt(myGrade)}` : "community"}
              </p>
            </div>
          </div>

          {/* The fight so far */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface px-4 py-3 shadow-card">
            {daysOpen !== null ? (
              <span className="text-sm text-muted">
                <span className="font-bold tabular-nums text-chalk">
                  {daysOpen}
                </span>{" "}
                day{daysOpen === 1 ? "" : "s"} open
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <RotateCcw size={14} className="text-wide" />
              <span className="font-bold tabular-nums text-chalk">
                {attempts ?? 0}
              </span>{" "}
              tr{(attempts ?? 0) === 1 ? "y" : "ies"} logged
            </span>
            <span className="flex items-center gap-1.5">
              <Stars value={myStars} size={15} />
            </span>
          </div>

          {/* The journal — private to you */}
          <section className="rounded-2xl bg-surface p-4 shadow-card">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
              <NotebookPen size={14} className="text-accent" /> Project notes
            </h2>
            <p className="mb-3 text-xs text-faint">
              Only you can see these. Beta, what's not working, conditions —
              keep it all here.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                "e.g. Left heel hook on the pinch, don't rush the throw.\nFelt close on the 3rd go — skin was trashed."
              }
              rows={6}
              className="w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base leading-relaxed text-chalk placeholder:text-faint outline-none focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-faint">
                {noteUpdatedAt
                  ? `Updated ${new Date(noteUpdatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : ""}
              </span>
              <Button
                variant="secondary"
                className="h-10 px-5"
                loading={savingNote}
                disabled={note === savedNote}
                onClick={saveNote}
              >
                {note === savedNote && savedNote !== "" ? "Saved" : "Save note"}
              </Button>
            </div>
          </section>

          {sent ? (
            <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
              <Check size={15} className="mr-1.5 inline" />
              You sent this one — it lives in your logbook now. Notes stay
              right here.
            </p>
          ) : null}
        </div>
      </div>

      {/* Sticky actions */}
      {!sent ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-app p-4 pb-6">
          <div className="pointer-events-auto">
            <Button className="w-full" onClick={() => setLogOpen(true)}>
              <Trophy size={16} className="mr-1.5" /> I sent it!
            </Button>
          </div>
        </div>
      ) : null}

      {logOpen ? (
        <LogSheet route={route} onClose={() => setLogOpen(false)} onSaved={onLogged} />
      ) : null}
    </div>
  );
}

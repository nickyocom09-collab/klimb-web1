import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Flag,
  NotebookPen,
  Trash2,
  Trophy,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { formatGradeStyled } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { DAY_MS } from "../lib/logstats";
import { Button, CenterSpinner } from "../components/ui";
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
  const [sent, setSent] = useState(false);
  const [sendType, setSendType] = useState<string | null>(null);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [myStars, setMyStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [celebrating, setCelebrating] = useState<null | "send" | "topped">(
    null,
  );

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
          .select("send_type")
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
    setSent(!!send && send.send_type !== "attempt");
    setSendType(send?.send_type ?? null);
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

  async function deleteProject() {
    if (!routeId || !profile) return;
    if (
      !window.confirm(
        "Remove this project? Your notes for it will be deleted too.",
      )
    )
      return;
    await Promise.all([
      supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", profile.id)
        .eq("route_id", routeId)
        .eq("kind", "project"),
      supabase
        .from("project_notes")
        .delete()
        .eq("user_id", profile.id)
        .eq("route_id", routeId),
    ]);
    navigate("/");
  }

  // Complete the project right here — log it, drop the project bookmark, then
  // celebrate. No extra page: the chooser IS the finish.
  async function completeProject(outcome: "send" | "topped") {
    if (!routeId || !profile) return;
    setFinishOpen(false);
    setCelebrating(outcome);
    await supabase.from("sends").upsert(
      {
        route_id: routeId,
        user_id: profile.id,
        send_type: outcome,
      },
      { onConflict: "route_id,user_id" },
    );
    await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", profile.id)
      .eq("route_id", routeId)
      .eq("kind", "project");
    window.setTimeout(
      () => navigate(`/route/${routeId}`, { replace: true }),
      1600,
    );
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
  const grade = myGrade ?? route.gym_grade;
  const daysOpen = since
    ? Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / DAY_MS))
    : null;

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {/* Hero photo */}
      <div className="relative">
        <img
          src={route.photo_url}
          alt={`${route.hold_color} route`}
          className="aspect-[16/10] w-full object-cover"
        />
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={deleteProject}
          aria-label="Remove project"
          className="absolute right-3 top-3 rounded-full bg-bg/70 p-2 text-faint backdrop-blur transition hover:text-wide"
        >
          <Trash2 size={20} />
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
                  {climbTypeLabel(route.climbing_type)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold leading-none tabular-nums text-accent">
                {fmt(grade)}
              </p>
              <p className="mt-1 text-xs text-faint">
                {myGrade !== null ? "your grade" : "gym grade"}
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
            sendType === "topped" ? (
              <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                <Flag size={15} className="mr-1.5 inline" />
                You topped this one — made the anchor, with falls. Get the
                clean run and upgrade it to Sent below.
              </p>
            ) : (
              <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                <Check size={15} className="mr-1.5 inline" />
                You sent this one — it lives in your logbook now. Notes stay
                right here.
              </p>
            )
          ) : null}
        </div>
      </div>

      {/* Sticky actions — completing the project, or upgrading a topped
          climb to the clean send. */}
      {!sent || sendType === "topped" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-app p-4 pb-6">
          <div className="pointer-events-auto">
            {sendType === "topped" ? (
              <Button className="w-full" onClick={() => completeProject("send")}>
                <Check size={16} className="mr-1.5" /> Sent it clean
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() =>
                  // Bouldering has no "topped with falls" — you either stick the
                  // whole problem or you don't, so there's nothing to choose.
                  // Top rope keeps the Sent/Topped chooser.
                  route.climbing_type === "boulder"
                    ? completeProject("send")
                    : setFinishOpen(true)
                }
              >
                <Trophy size={16} className="mr-1.5" /> Complete project
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* How'd you finish? — Sent (clean) or Topped (with falls). Top rope
          only; bouldering skips straight to Sent. Completes right here, no
          extra page. No flash — you've been working this one. */}
      {finishOpen ? (
        <div
          className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4 backdrop-blur-[2px]"
          onClick={() => setFinishOpen(false)}
        >
          <div
            className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-extrabold text-chalk">
              Nice — how'd you finish?
            </p>
            <p className="mt-1 text-sm text-muted">
              You can always upgrade a Topped climb to a clean Sent later.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => completeProject("send")}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface-2 py-5 text-chalk transition active:scale-[0.98] hover:border-accent"
              >
                <Check size={24} className="text-accent" />
                <span className="text-sm font-bold">Sent</span>
                <span className="text-[11px] text-faint">Clean, no falls</span>
              </button>
              <button
                onClick={() => completeProject("topped")}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface-2 py-5 text-chalk transition active:scale-[0.98] hover:border-accent"
              >
                <Flag size={24} className="text-accent" />
                <span className="text-sm font-bold">Topped</span>
                <span className="text-[11px] text-faint">Made it, with falls</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Satisfying finish moment */}
      {celebrating ? (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in flex-col items-center justify-center gap-3 bg-bg/92 backdrop-blur-sm">
          <span className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" />
            <span
              className="absolute inset-0 rounded-full bg-accent/20"
              style={{ animation: "klimb-spark-ring 0.85s ease-out forwards" }}
            />
            <span className="flex h-20 w-20 animate-pop items-center justify-center rounded-full bg-accent text-bg shadow-glow">
              {celebrating === "topped" ? (
                <Flag size={34} strokeWidth={2.5} />
              ) : (
                <Trophy size={36} strokeWidth={2.5} />
              )}
            </span>
          </span>
          <p className="animate-fade-up text-3xl font-extrabold text-chalk [animation-delay:120ms]">
            {celebrating === "topped" ? "Topped!" : "Sent it!"}
          </p>
          <p className="animate-fade-up text-sm text-muted [animation-delay:220ms]">
            {celebrating === "topped"
              ? "Made the anchor — go back for the clean send."
              : "Project crushed. Straight into the book."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

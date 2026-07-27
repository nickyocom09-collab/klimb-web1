import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Flag,
  NotebookPen,
  Pencil,
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
import { LogSheet } from "../components/LogSheet";

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
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteUpdatedAt, setNoteUpdatedAt] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [celebrating, setCelebrating] = useState<null | "send" | "topped">(
    null,
  );

  const load = useCallback(async () => {
    if (!routeId || !profile) return;
    setLoading(true);
    const [r, { data: bm }, { data: send }, { data: grade }, { data: pn }] =
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

  // Topping a rope route records its progress but leaves it open. A clean send
  // is the only outcome that graduates a project out of this space.
  async function completeProject(outcome: "send" | "topped") {
    if (!routeId || !profile) return;
    setCelebrating(outcome);
    await supabase.from("sends").upsert(
      {
        route_id: routeId,
        user_id: profile.id,
        send_type: outcome,
      },
      { onConflict: "route_id,user_id" },
    );
    if (outcome === "send") {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", profile.id)
        .eq("route_id", routeId)
        .eq("kind", "project");
      window.setTimeout(
        () => navigate(`/route/${routeId}`, { replace: true }),
        1400,
      );
    } else {
      setSent(true);
      setSendType("topped");
      window.setTimeout(() => setCelebrating(null), 1150);
    }
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
  const hasOfficialGrade =
    route.gym_grade !== null && route.gym_grade !== undefined;
  const grade = route.gym_grade ?? myGrade;
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
          {sendType === "topped" ? <Flag size={12} /> : <Bookmark size={12} />}
          {sendType === "topped" ? "Topped" : "In progress"}
        </span>
      </div>

      <div
        className={`flex-1 overflow-y-auto px-5 pt-4 ${
          !sent &&
          sendType !== "topped" &&
          route.climbing_type !== "boulder"
            ? "pb-52"
            : "pb-36"
        }`}
      >
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
            <div className="flex items-start gap-2">
              <div className="text-right">
                <p className="klimb-grade text-3xl font-extrabold leading-none text-accent">
                  {fmt(grade)}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {grade === null
                    ? "Not graded"
                    : hasOfficialGrade
                      ? "official grade"
                      : "You say"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label="Edit project details"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-muted transition hover:text-chalk"
              >
                <Pencil size={15} />
              </button>
            </div>
          </div>

          {/* The fight so far */}
          <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 shadow-card">
            {daysOpen !== null ? (
              <span className="text-sm text-muted">
                <span className="font-bold tabular-nums text-chalk">
                  {daysOpen}
                </span>{" "}
                day{daysOpen === 1 ? "" : "s"} open
              </span>
            ) : null}
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              sendType === "topped"
                ? "bg-accent/15 text-accent"
                : "bg-surface-2 text-muted"
            }`}>
              {sendType === "topped" ? "Topped" : "Not topped"}
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
                Topped. This project stays open until you complete it clean.
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

      {/* Project actions stay explicit: topped records progress; complete
          project closes it and moves it into Sends. */}
      {!sent || sendType === "topped" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app bg-gradient-to-t from-bg via-bg/98 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
          <div className="pointer-events-auto rounded-3xl border border-border bg-surface/95 p-2 shadow-card backdrop-blur">
            <Button
              className="h-14 w-full rounded-[1.25rem]"
              onClick={() => completeProject("send")}
            >
              <Trophy size={19} className="mr-2 shrink-0" />
              <span className="whitespace-nowrap">Complete project</span>
            </Button>
            {sendType !== "topped" && route.climbing_type !== "boulder" ? (
              <Button
                className="mt-2 h-14 w-full rounded-[1.25rem]"
                variant="secondary"
                onClick={() => completeProject("topped")}
              >
                <Flag size={17} className="mr-2 shrink-0 text-accent" />
                <span className="whitespace-nowrap">Mark as topped</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <LogSheet
          route={route}
          initialOutcome={sendType === "topped" ? "topped" : "project"}
          initialFeltGrade={myGrade}
          editing
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await load();
          }}
        />
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

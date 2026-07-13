import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  Bookmark,
  Check,
  ChevronLeft,
  History,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { formatGrade, formatGymGrade } from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { Button, CenterSpinner } from "../components/ui";
import { LogSheet } from "../components/LogSheet";
import type { RouteEventRow, SendType } from "../lib/database.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A climb's page: the photo, what climbers say it is, your log, and its
 * history. Read-only by design — once logged, nothing changes here unless
 * you hit "Edit log."
 */
export function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [route, setRoute] = useState<RouteWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [hasSent, setHasSent] = useState(false);
  const [mySendType, setMySendType] = useState<SendType | null>(null);
  const [myNote, setMyNote] = useState<string | null>(null);
  const [isProject, setIsProject] = useState(false);
  const [events, setEvents] = useState<RouteEventRow[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    const [r, { data: mine }, { data: mySend }, { data: bm }, { data: eventRows }] =
      await Promise.all([
        fetchRoute(id),
        supabase
          .from("grades")
          .select("grade")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("sends")
          .select("send_type, note")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("bookmarks")
          .select("id")
          .eq("route_id", id)
          .eq("user_id", profile.id)
          .eq("kind", "project")
          .maybeSingle(),
        supabase
          .from("route_events")
          .select("*")
          .eq("route_id", id)
          .order("created_at", { ascending: false }),
      ]);
    setRoute(r);
    setMyGrade(mine?.grade ?? null);
    setHasSent(!!mySend && mySend.send_type !== "attempt");
    setMySendType(mySend?.send_type ?? null);
    setMyNote(mySend?.note ?? null);
    setIsProject(!!bm);
    setEvents(eventRows ?? []);
    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteLog() {
    if (!id || !profile) return;
    if (!window.confirm("Delete this climb from your logbook?")) return;
    await supabase
      .from("sends")
      .delete()
      .eq("route_id", id)
      .eq("user_id", profile.id);
    navigate("/");
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
        <p className="text-faint">Climb not found.</p>
        <Button onClick={() => navigate("/")}>Back to logbook</Button>
      </div>
    );
  }

  const fmt = (g: number | null | undefined) =>
    formatGrade(g, route.climbing_type, system);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      {/* Media */}
      <div className="relative">
        {route.video_url ? (
          <video
            src={route.video_url}
            poster={route.photo_url}
            className="aspect-[4/3] w-full bg-black object-cover"
            autoPlay
            muted
            loop
            playsInline
            controls
          />
        ) : (
          <img
            src={route.photo_url}
            alt={`${route.hold_color} route on ${route.wall_section}`}
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
        <div className="flex flex-col gap-5">
          {/* Identity */}
          <div>
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
            <p className="mt-2 text-xs text-faint">
              {formatDate(route.created_at)}
            </p>
          </div>

          {/* Your grade vs the gym's grade */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Your grade
              </p>
              <p
                key={myGrade ?? -1}
                className="mt-0.5 animate-pop text-4xl font-extrabold leading-none tabular-nums text-accent"
              >
                {fmt(myGrade)}
              </p>
              <p className="mt-1.5 text-xs text-faint">
                {myGrade !== null ? "what it felt like" : "not graded yet"}
              </p>
            </div>
            {route.gym_grade !== null && route.gym_grade !== undefined ? (
              <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Gym says
                </p>
                <p className="mt-0.5 text-4xl font-extrabold leading-none tabular-nums text-chalk">
                  {formatGymGrade(
                    route.gym_grade,
                    route.climbing_type,
                    system,
                    route.gradingStyle,
                  )}
                </p>
                <p className="mt-1.5 text-xs text-faint">official grade</p>
              </div>
            ) : null}
          </div>

          {/* Your log — read-only until you hit Edit */}
          {hasSent ? (
            <div className="rounded-2xl bg-surface p-4 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-bold text-chalk">
                  {mySendType === "flash" ? (
                    <>
                      <Zap size={16} className="text-accent" /> You flashed this
                    </>
                  ) : (
                    <>
                      <Check size={16} className="text-accent" /> You sent this
                    </>
                  )}
                  {myGrade !== null ? (
                    <span className="text-muted">· felt {fmt(myGrade)}</span>
                  ) : null}
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={deleteLog}
                    aria-label="Delete this log"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint transition hover:text-wide"
                  >
                    <Trash2 size={16} />
                  </button>
                  <Button
                    variant="secondary"
                    className="h-10 px-4"
                    onClick={() => setLogOpen(true)}
                  >
                    <Pencil size={14} className="mr-1.5" /> Edit
                  </Button>
                </div>
              </div>
              {myNote ? (
                <p className="mt-2 text-sm italic text-muted">"{myNote}"</p>
              ) : null}
            </div>
          ) : isProject ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => navigate(`/project/${route.id}`)}
            >
              <Bookmark size={16} className="mr-2 text-accent" /> On your project
              board — open the journal
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setLogOpen(true)}>
              <Trophy size={18} className="mr-2" /> Log this climb
            </Button>
          )}

          {/* Route history — the permanent timeline of this climb. */}
          {events.length > 0 ? (
            <section className="rounded-2xl bg-surface p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                <History size={14} className="text-accent" /> History
              </h2>
              <ul className="relative flex flex-col gap-4 pl-1">
                {events.map((e, i) => {
                  let Icon = Plus;
                  let text: React.ReactNode = "Route posted";
                  if (e.kind === "created") {
                    Icon = Plus;
                    text =
                      e.detail.gym_grade !== null &&
                      e.detail.gym_grade !== undefined ? (
                        <>
                          Route posted — gym graded it{" "}
                          <span className="font-semibold text-chalk">
                            {formatGymGrade(
                              e.detail.gym_grade,
                              route.climbing_type,
                              system,
                              route.gradingStyle,
                            )}
                          </span>
                        </>
                      ) : (
                        "Route posted"
                      );
                  } else if (e.kind === "grade_shift") {
                    Icon = TrendingUp;
                    text = (
                      <>
                        Grade moved{" "}
                        <span className="font-semibold text-chalk">
                          {fmt(e.detail.from)}
                        </span>{" "}
                        →{" "}
                        <span className="font-semibold text-accent">
                          {fmt(e.detail.to)}
                        </span>
                      </>
                    );
                  } else if (e.kind === "archived") {
                    Icon = Archive;
                    text = "Route retired from the wall";
                  }
                  return (
                    <li key={e.id} className="flex items-start gap-3">
                      <span className="relative flex flex-col items-center">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-accent">
                          <Icon size={14} />
                        </span>
                        {i < events.length - 1 ? (
                          <span className="absolute top-7 h-[calc(100%+0.35rem)] w-px bg-border" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1 pt-1">
                        <span className="block text-sm text-chalk/90">{text}</span>
                        <span className="mt-0.5 block text-xs text-faint">
                          {formatDate(e.created_at)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/* Edit / first log — the unified sheet */}
      {logOpen && route ? (
        <LogSheet
          route={route}
          onClose={() => setLogOpen(false)}
          onSaved={async () => {
            setLogOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

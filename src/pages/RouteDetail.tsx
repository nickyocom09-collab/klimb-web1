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
  Sparkles,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import {
  communityGrade,
  formatGrade,
  formatGymGrade,
} from "../lib/grades";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { aiConsensus } from "../lib/ai";
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
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [hasSent, setHasSent] = useState(false);
  const [mySendType, setMySendType] = useState<SendType | null>(null);
  const [myNote, setMyNote] = useState<string | null>(null);
  const [isProject, setIsProject] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [events, setEvents] = useState<RouteEventRow[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    const [r, { data: mine }, { data: mySend }, { data: bm }, { data: eventRows }, { data: logPhotos }] =
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
        supabase
          .from("sends")
          .select("photo_url")
          .eq("route_id", id)
          .not("photo_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
    setRoute(r);
    setMyGrade(mine?.grade ?? null);
    setHasSent(!!mySend && mySend.send_type !== "attempt");
    setMySendType(mySend?.send_type ?? null);
    setMyNote(mySend?.note ?? null);
    setIsProject(!!bm);
    setEvents(eventRows ?? []);
    setGallery(
      (logPhotos ?? [])
        .map((p) => p.photo_url)
        .filter((p): p is string => !!p),
    );
    if (r?.created_by) {
      const { data: author } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", r.created_by)
        .maybeSingle();
      setAuthorName(author?.display_name ?? null);
    } else {
      setAuthorName(null);
    }
    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    load();
  }, [load]);

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
  const realVotes = route.gradeValues.length;
  const median = communityGrade(route.gradeValues);
  // What climbers say: real consensus once 2+ votes exist; before that, the
  // logged grade (yours) with the Klimb AI vouching for it.
  const displayGrade = realVotes >= 2 ? median : (myGrade ?? median);
  const ai =
    displayGrade !== null && realVotes < 2
      ? aiConsensus(route.id, fmt(displayGrade))
      : null;

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
              {authorName ? `Logged by ${authorName} · ` : ""}
              {formatDate(route.created_at)}
            </p>
          </div>

          {/* Crowd gallery */}
          {gallery.length > 0 ? (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {gallery.map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt={`Log photo ${i + 1}`}
                  loading="lazy"
                  style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
                  className="h-20 w-20 shrink-0 animate-fade-up rounded-2xl object-cover shadow-card"
                />
              ))}
            </div>
          ) : null}

          {/* Climbers say vs Gym says */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Climbers say
              </p>
              <p
                key={displayGrade ?? -1}
                className="mt-0.5 animate-pop text-4xl font-extrabold leading-none tabular-nums text-accent"
              >
                {fmt(displayGrade)}
              </p>
              <p className="mt-1.5 text-xs text-faint">
                {realVotes >= 2
                  ? `${realVotes} grades logged`
                  : displayGrade !== null
                    ? "your grade"
                    : "no grade yet"}
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

          {/* Klimb AI consensus — the app vouches for your grade */}
          {ai ? (
            <div className="flex items-start gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <Sparkles size={14} className="text-accent" />
              </span>
              <div>
                <p className="text-sm text-chalk/90">{ai.line}</p>
                <p className="mt-0.5 text-[10px] text-faint">Klimb AI</p>
              </div>
            </div>
          ) : null}

          {/* At a glance */}
          <p className="ml-1 text-xs text-muted">
            {route.climbers > 0 ? (
              <>
                <span className="font-semibold text-chalk">{route.climbers}</span>{" "}
                climber{route.climbers === 1 ? "" : "s"} logged this
                {route.funAvg !== null && route.funCount > 0 ? (
                  <> · ★ {route.funAvg.toFixed(1)}</>
                ) : null}
                {route.avgAttempts !== null ? (
                  <>
                    {" "}
                    · avg{" "}
                    <span className="font-semibold text-chalk">
                      {Math.round(route.avgAttempts * 10) / 10}
                    </span>{" "}
                    tries
                  </>
                ) : null}
              </>
            ) : (
              <>Not logged by anyone else yet.</>
            )}
          </p>

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
                <Button
                  variant="secondary"
                  className="h-10 shrink-0 px-4"
                  onClick={() => setLogOpen(true)}
                >
                  <Pencil size={14} className="mr-1.5" /> Edit log
                </Button>
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

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  BarChart3,
  Bookmark,
  Check,
  ChevronLeft,
  Flag,
  Heart,
  History,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import {
  communityGrade,
  formatGradeStyled,
  gradeConsensus,
} from "../lib/grades";
import {
  climbTypeLabel,
  holdHex,
  REPORT_REASONS,
} from "../lib/constants";
import type { ReportReason } from "../lib/constants";
import { fetchRouteBookmarks, toggleBookmark } from "../lib/bookmarks";
import { routeSummary } from "../lib/summary";
import { Button, CenterSpinner } from "../components/ui";
import { LogSheet } from "../components/LogSheet";
import { GradeBar } from "../components/GradeBar";
import { GradeDonut } from "../components/GradeDonut";
import { GradePicker } from "../components/GradePicker";
import { Stars } from "../components/Stars";
import type {
  BookmarkKind,
  RouteEventRow,
  SendType,
} from "../lib/database.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [route, setRoute] = useState<RouteWithStats | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [draftGrade, setDraftGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [mySendType, setMySendType] = useState<SendType | null>(null);
  // Photos attached to logs — the route's crowd-built gallery.
  const [gallery, setGallery] = useState<string[]>([]);
  const [events, setEvents] = useState<RouteEventRow[]>([]);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [othersEngaged, setOthersEngaged] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportingRoute, setReportingRoute] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [hasReportedGone, setHasReportedGone] = useState(false);
  const [myStars, setMyStars] = useState<number | null>(null);

  const [bookmarks, setBookmarks] = useState<Set<BookmarkKind>>(new Set());

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    const r = await fetchRoute(id);
    setRoute(r);

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

    const { data: mine } = await supabase
      .from("grades")
      .select("grade")
      .eq("route_id", id)
      .eq("user_id", profile.id)
      .maybeSingle();
    setMyGrade(mine?.grade ?? null);
    setDraftGrade(mine?.grade ?? null);

    const { data: mySend } = await supabase
      .from("sends")
      .select("send_type")
      .eq("route_id", id)
      .eq("user_id", profile.id)
      .maybeSingle();
    setHasSent(!!mySend);
    setMySendType(mySend?.send_type ?? null);

    // Route history — the permanent timeline of this route's life.
    const { data: eventRows } = await supabase
      .from("route_events")
      .select("*")
      .eq("route_id", id)
      .order("created_at", { ascending: false });
    setEvents(eventRows ?? []);

    // Crowd gallery: photos people attached to their logs.
    const { data: logPhotos } = await supabase
      .from("sends")
      .select("photo_url")
      .eq("route_id", id)
      .not("photo_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);
    setGallery(
      (logPhotos ?? [])
        .map((p) => p.photo_url)
        .filter((p): p is string => !!p),
    );

    const { data: myRating } = await supabase
      .from("route_ratings")
      .select("stars")
      .eq("route_id", id)
      .eq("user_id", profile.id)
      .maybeSingle();
    setMyStars(myRating?.stars ?? null);

    const { count: myGoneCount } = await supabase
      .from("gone_reports")
      .select("*", { count: "exact", head: true })
      .eq("route_id", id)
      .eq("user_id", profile.id);
    setHasReportedGone((myGoneCount ?? 0) > 0);

    setBookmarks(await fetchRouteBookmarks(profile.id, id));

    if (r && r.created_by) {
      const creator = r.created_by;
      const [{ count: gradeCount }, { count: sendCount }, { count: commentCount }] =
        await Promise.all([
          supabase
            .from("grades")
            .select("*", { count: "exact", head: true })
            .eq("route_id", id)
            .neq("user_id", creator),
          supabase
            .from("sends")
            .select("*", { count: "exact", head: true })
            .eq("route_id", id)
            .neq("user_id", creator),
          supabase
            .from("comments")
            .select("*", { count: "exact", head: true })
            .eq("route_id", id)
            .neq("user_id", creator),
        ]);
      setOthersEngaged(
        (gradeCount ?? 0) > 0 || (sendCount ?? 0) > 0 || (commentCount ?? 0) > 0,
      );
    } else {
      setOthersEngaged(true);
    }

    setLoading(false);
  }, [id, profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveGrade() {
    if (!id || !profile || draftGrade === null) return;
    setSavingGrade(true);
    await supabase.from("grades").upsert(
      {
        route_id: id,
        user_id: profile.id,
        grade: draftGrade,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "route_id,user_id" },
    );
    setMyGrade(draftGrade);
    setRoute(await fetchRoute(id));
    setSavingGrade(false);
  }

  // Tap-to-rate is optimistic: stars flip instantly, then persist. The route
  // stats (community average) refresh quietly afterwards.
  async function rateFun(stars: number) {
    if (!id || !profile) return;
    const prev = myStars;
    setMyStars(stars);
    const { error } = await supabase.from("route_ratings").upsert(
      {
        route_id: id,
        user_id: profile.id,
        stars,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "route_id,user_id" },
    );
    if (error) {
      setMyStars(prev);
      return;
    }
    setRoute(await fetchRoute(id));
  }


  async function flipBookmark(kind: BookmarkKind) {
    if (!id || !profile) return;
    const active = bookmarks.has(kind);
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (active) next.delete(kind);
      else next.add(kind);
      return next;
    });
    try {
      await toggleBookmark(profile.id, id, kind, active);
    } catch {
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (active) next.add(kind);
        else next.delete(kind);
        return next;
      });
    }
  }

  async function reportRoute(reason: ReportReason) {
    if (!id) return;
    setReportingRoute(true);
    const { data, error } = await supabase.rpc("report_route", {
      p_route_id: id,
      p_reason: reason,
    });
    setReportingRoute(false);
    setReportOpen(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    if ((data ?? 0) >= 3) {
      window.alert(
        "Thanks — this route has received enough reports and is now hidden pending review.",
      );
      navigate("/", { replace: true });
    } else {
      window.alert(`Report submitted. ${data}/3 reports so far.`);
    }
  }

  async function reportGone() {
    if (!id || hasReportedGone) return;
    if (
      !window.confirm(
        "Report this route as gone? After 3 reports it gets archived.",
      )
    )
      return;
    setReporting(true);
    const { data, error } = await supabase.rpc("report_route_gone", {
      p_route_id: id,
    });
    setReporting(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    setHasReportedGone(true);
    if ((data ?? 0) >= 3) {
      window.alert("This route has been archived. Thanks for the heads up!");
      navigate("/", { replace: true });
    } else {
      window.alert(`Reported. ${data}/3 reports so far.`);
      setRoute(await fetchRoute(id));
    }
  }

  async function deleteRoute() {
    if (!id) return;
    if (
      !window.confirm(
        "Delete this route? This permanently removes it along with its grades, sends, and comments.",
      )
    )
      return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_route", { p_route_id: id });
    setDeleting(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    navigate("/", { replace: true });
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
        <Button onClick={() => navigate("/")}>Back to feed</Button>
      </div>
    );
  }

  const grade = communityGrade(route.gradeValues);
  const { tone, count } = gradeConsensus(route.gradeValues);
  // Every grade on this page renders in the gym's house style.
  const fmt = (g: number | null | undefined) =>
    formatGradeStyled(g, route.climbing_type, system, route.gradingStyle);

  const summary = routeSummary({
    gradeValues: route.gradeValues,
    gymGrade: route.gym_grade,
    climbingType: route.climbing_type,
    system,
    gradeStyle: route.gradingStyle,
    funAvg: route.funAvg,
    funCount: route.funCount,
    sendCount: route.sendCount,
    comments: [],
  });

  let verdictLabel = "No grades yet";
  if (count === 1) verdictLabel = "1 grade so far";
  else if (count > 1 && tone === "green") verdictLabel = "Strong consensus";
  else if (count > 1) verdictLabel = "Contested";
  const verdictClass =
    tone === "green"
      ? "text-accent"
      : tone === "orange"
        ? "text-wide"
        : "text-faint";

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
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
          className="absolute left-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
        <div className="flex flex-col gap-5">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              <div>
                <p className="text-lg font-bold text-chalk">
                  {route.hold_color}
                </p>
                <p className="text-sm text-muted">
                  {route.wall_section} · {climbTypeLabel(route.climbing_type)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-faint">
              {authorName ? `Posted by ${authorName} · ` : ""}
              {formatDate(route.created_at)}
            </p>
          </div>

          {/* Community says vs gym says */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Community says
              </p>
              <p
                key={grade ?? -1}
                className="mt-0.5 animate-pop text-4xl font-extrabold leading-none tabular-nums text-accent"
              >
                {fmt(grade)}
              </p>
              <p className={`mt-1.5 text-xs font-semibold ${verdictClass}`}>
                {verdictLabel}
              </p>
            </div>
            {route.gym_grade !== null && route.gym_grade !== undefined ? (
              <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Gym says
                </p>
                <p className="mt-0.5 text-4xl font-extrabold leading-none text-chalk">
                  {fmt(route.gym_grade)}
                </p>
                <p className="mt-1.5 text-xs text-faint">official grade</p>
              </div>
            ) : null}
          </div>

          {/* Crowd gallery — photos from everyone's logs */}
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

          {/* Shared intelligence at a glance */}
          <p className="ml-1 text-xs text-muted">
            {route.climbers > 0 ? (
              <>
                <span className="font-semibold text-chalk">
                  {route.climbers}
                </span>{" "}
                climber{route.climbers === 1 ? "" : "s"} logged this
                {route.avgAttempts !== null ? (
                  <>
                    {" "}
                    · avg{" "}
                    <span className="font-semibold text-chalk">
                      {Math.round(route.avgAttempts * 10) / 10}
                    </span>{" "}
                    tries
                  </>
                ) : null}{" "}
                · set {formatDate(route.created_at)}
              </>
            ) : (
              <>No logs yet — be the first on it. Set {formatDate(route.created_at)}</>
            )}
          </p>

          {/* Vote breakdown */}
          <button
            onClick={() => setStatsOpen(true)}
            className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <BarChart3 size={18} className="text-accent" /> See the vote
              breakdown
            </span>
            <span className="text-sm text-muted">
              {route.gradeValues.length} vote
              {route.gradeValues.length === 1 ? "" : "s"} · {route.sendCount}{" "}
              send{route.sendCount === 1 ? "" : "s"}
            </span>
          </button>

          {/* Auto-summary of the route's opinions */}
          <div className="rounded-2xl bg-surface p-4 shadow-card">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
              <Sparkles size={14} className="text-accent" /> Route pulse
            </h2>
            <p className="text-sm leading-relaxed text-chalk/90">{summary}</p>
            <p className="mt-2 text-[10px] text-faint">
              Auto-generated from grades, ratings & comments
            </p>
          </div>

          {/* Fun factor — 5-star community rating */}
          <div className="rounded-2xl bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">
                Fun factor
              </h2>
              {route.funCount > 0 && route.funAvg !== null ? (
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <Stars value={route.funAvg} size={13} />
                  <span className="text-sm font-bold text-chalk">
                    {route.funAvg.toFixed(1)}
                  </span>
                  · {route.funCount} rating{route.funCount === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-xs text-faint">No ratings yet</span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Stars value={myStars} onChange={rateFun} size={30} />
              <span className="text-xs text-faint">
                {myStars !== null ? "Your rating" : "How fun was it?"}
              </span>
            </div>
          </div>

          {/* Save / favorite */}
          <div className="flex gap-2">
            <button
              onClick={() => flipBookmark("project")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                bookmarks.has("project")
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-muted hover:text-chalk"
              }`}
            >
              <Bookmark
                size={16}
                fill={bookmarks.has("project") ? "currentColor" : "none"}
              />
              {bookmarks.has("project") ? "Project" : "Save to try"}
            </button>
            <button
              onClick={() => flipBookmark("favorite")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                bookmarks.has("favorite")
                  ? "bg-accent/15 text-accent"
                  : "bg-surface text-muted hover:text-chalk"
              }`}
            >
              <Heart
                size={16}
                fill={bookmarks.has("favorite") ? "currentColor" : "none"}
              />
              {bookmarks.has("favorite") ? "Favorited" : "Favorite"}
            </button>
          </div>

          {route.description ? (
            <p className="text-sm text-muted">{route.description}</p>
          ) : null}

          {/* Your grade */}
          <div className="rounded-2xl bg-surface p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
              {myGrade === null ? "What do you think it's graded?" : "Your grade"}
            </h2>
            <GradePicker
              value={draftGrade}
              onChange={setDraftGrade}
              climbingType={route.climbing_type}
              system={system}
              gradeStyle={route.gradingStyle}
            />
            <Button
              className="mt-3 w-full"
              variant={draftGrade === myGrade ? "secondary" : "primary"}
              disabled={draftGrade === null || draftGrade === myGrade}
              loading={savingGrade}
              onClick={saveGrade}
            >
              {myGrade === null ? "Submit grade" : "Update grade"}
            </Button>
          </div>

          {/* Log — the same sheet as the Log tab (unified logging path) */}
          {hasSent && mySendType !== "attempt" ? (
            <Button className="w-full" variant="secondary" disabled>
              {mySendType === "flash" ? (
                <>
                  <Zap size={18} className="mr-2" /> Flashed
                </>
              ) : (
                <>
                  <Check size={18} className="mr-2" /> Sent
                </>
              )}
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setLogOpen(true)}>
              <Trophy size={18} className="mr-2" />
              {mySendType === "attempt"
                ? "Tried it — log another go"
                : "Log this climb"}
            </Button>
          )}

          {/* Route history — the permanent timeline of this route's life. */}
          {events.length > 0 ? (
            <section className="rounded-2xl bg-surface p-4 shadow-card">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
                <History size={14} className="text-accent" /> Route history
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
                            {fmt(e.detail.gym_grade)}
                          </span>
                        </>
                      ) : (
                        "Route posted"
                      );
                  } else if (e.kind === "grade_shift") {
                    Icon = TrendingUp;
                    text = (
                      <>
                        Community grade moved{" "}
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
                        <span className="block text-sm text-chalk/90">
                          {text}
                        </span>
                        <span className="mt-0.5 block text-xs text-faint">
                          {formatDate(e.created_at)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {route.status === "archived" ? (
                <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
                  This route is retired, but it stays in every logbook that
                  climbed it — your history doesn't disappear with the holds.
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Route gone / report / delete */}
          <div className="pt-2">
            <button
              onClick={reportGone}
              disabled={reporting || hasReportedGone}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-wide transition hover:bg-wide/10 disabled:opacity-50"
            >
              <Flag size={16} />
              {hasReportedGone ? "You reported this gone" : "This route is gone"}
            </button>
            <p className="mt-1 text-center text-xs text-faint">
              {route.gone_reports}/3 reports
            </p>

            <button
              onClick={() => setReportOpen(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-faint transition hover:text-wide"
            >
              <ShieldAlert size={16} /> Report this route
            </button>

            {profile?.id === route.created_by ? (
              othersEngaged ? (
                <p className="mt-3 text-center text-xs text-faint">
                  Others have graded, sent, or commented, so this route can't be
                  deleted. Use "This route is gone" to retire it.
                </p>
              ) : (
                <button
                  onClick={deleteRoute}
                  disabled={deleting}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-faint transition hover:text-wide disabled:opacity-50"
                >
                  <Trash2 size={16} /> Delete this route
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats sheet */}
      {statsOpen ? (
        <div
          className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4"
          onClick={() => setStatsOpen(false)}
        >
          <div
            className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-chalk">Vote breakdown</h3>
              <button
                onClick={() => setStatsOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-faint transition hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>
            <GradeDonut
              grades={route.gradeValues}
              climbingType={route.climbing_type}
              system={system}
              gradeStyle={route.gradingStyle}
            />
            {route.gradeValues.length > 0 ? (
              <div className="mt-5">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
                  Distribution
                </h4>
                <GradeBar
                  grades={route.gradeValues}
                  climbingType={route.climbing_type}
                  system={system}
                  gradeStyle={route.gradingStyle}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Unified log sheet — same component as the Log tab */}
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

      {/* Report route reasons sheet */}
      {reportOpen ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-lg font-bold text-chalk">Report this route</h3>
            <p className="mt-1 text-sm text-muted">
              Why are you reporting it? After 3 reports it's hidden pending
              review.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  disabled={reportingRoute}
                  onClick={() => reportRoute(r.value)}
                  className="w-full rounded-2xl bg-surface-2 py-3 text-sm font-semibold text-chalk transition hover:ring-1 hover:ring-accent disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setReportOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

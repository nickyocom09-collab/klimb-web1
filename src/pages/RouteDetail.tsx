import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Ban,
  Bookmark,
  Check,
  ChevronLeft,
  Flag,
  Heart,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  Trophy,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGrade } from "../lib/grades";
import {
  climbTypeLabel,
  CONTENT_REPORT_REASONS,
  holdHex,
  REPORT_REASONS,
} from "../lib/constants";
import type { ContentReason, ReportReason } from "../lib/constants";
import { fetchRouteBookmarks, toggleBookmark } from "../lib/bookmarks";
import {
  blockUser,
  fetchBlockedIds,
  reportContent,
} from "../lib/moderation";
import { Button, CenterSpinner, Card, Spinner } from "../components/ui";
import { GradeBar } from "../components/GradeBar";
import { GradePicker } from "../components/GradePicker";
import type { BookmarkKind, CommentRow } from "../lib/database.types";

type CommentWithAuthor = CommentRow & { authorName: string };

export function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const system = profile?.grade_system ?? "american";

  const [route, setRoute] = useState<RouteWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [myGrade, setMyGrade] = useState<number | null>(null);
  const [draftGrade, setDraftGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [othersEngaged, setOthersEngaged] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportingRoute, setReportingRoute] = useState(false);

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isBeta, setIsBeta] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const [bookmarks, setBookmarks] = useState<Set<BookmarkKind>>(new Set());
  const [savingBookmark, setSavingBookmark] = useState<BookmarkKind | null>(
    null,
  );

  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [menuCommentId, setMenuCommentId] = useState<string | null>(null);
  const [reportComment, setReportComment] = useState<CommentWithAuthor | null>(
    null,
  );
  const [reportingComment, setReportingComment] = useState(false);

  const loadComments = useCallback(async (routeId: string) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("route_id", routeId)
      .eq("hidden", false)
      .order("created_at", { ascending: true });
    const rows = data ?? [];
    const userIds = [...new Set(rows.map((c) => c.user_id))];
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      for (const u of users ?? []) nameMap.set(u.id, u.display_name);
    }
    setComments(
      rows.map((c) => ({ ...c, authorName: nameMap.get(c.user_id) ?? "Climber" })),
    );
  }, []);

  const load = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    const r = await fetchRoute(id);
    setRoute(r);
    const { data: mine } = await supabase
      .from("grades")
      .select("grade")
      .eq("route_id", id)
      .eq("user_id", profile.id)
      .maybeSingle();
    setMyGrade(mine?.grade ?? null);
    setDraftGrade(mine?.grade ?? null);

    // Whether the current user has already logged a send (one per user).
    const { count: mySendCount } = await supabase
      .from("sends")
      .select("*", { count: "exact", head: true })
      .eq("route_id", id)
      .eq("user_id", profile.id);
    setHasSent((mySendCount ?? 0) > 0);

    await loadComments(id);

    setBookmarks(await fetchRouteBookmarks(profile.id, id));
    setBlockedIds(await fetchBlockedIds(profile.id));

    // The creator may hard-delete a route only while nobody else has engaged
    // (no grades, sends, or comments from anyone but the creator). Once others
    // have touched it, it can only be retired via report-gone → archive.
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
        (gradeCount ?? 0) > 0 ||
          (sendCount ?? 0) > 0 ||
          (commentCount ?? 0) > 0,
      );
    } else {
      setOthersEngaged(true);
    }

    setLoading(false);
  }, [id, profile, loadComments]);

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

  async function logSend() {
    if (!id || !profile || hasSent) return;
    setSending(true);
    // One send per route per user — ignore duplicates if tapped twice.
    await supabase.from("sends").upsert(
      { route_id: id, user_id: profile.id },
      { onConflict: "route_id,user_id", ignoreDuplicates: true },
    );
    setHasSent(true);
    setRoute(await fetchRoute(id));
    setSending(false);
  }

  async function blockClimber(c: CommentWithAuthor) {
    if (!profile) return;
    if (
      !window.confirm(
        `Block ${c.authorName}? You won't see their comments or activity anymore.`,
      )
    )
      return;
    setMenuCommentId(null);
    const { error } = await blockUser(profile.id, c.user_id);
    if (error) {
      window.alert(error);
      return;
    }
    setBlockedIds((prev) => new Set(prev).add(c.user_id));
  }

  async function submitCommentReport(reason: ContentReason) {
    if (!reportComment) return;
    setReportingComment(true);
    const { count, error } = await reportContent(
      "comment",
      reportComment.id,
      reason,
    );
    setReportingComment(false);
    const target = reportComment;
    setReportComment(null);
    if (error) {
      window.alert(error);
      return;
    }
    if (count >= 3 && id) {
      // Auto-hidden server-side — drop it from view immediately.
      setComments((prev) => prev.filter((x) => x.id !== target.id));
      window.alert("Thanks — this comment was hidden pending review.");
    } else {
      window.alert("Report submitted. Thanks for keeping Klimb clean.");
    }
  }

  async function flipBookmark(kind: BookmarkKind) {
    if (!id || !profile) return;
    const active = bookmarks.has(kind);
    setSavingBookmark(kind);
    // Optimistic toggle.
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (active) next.delete(kind);
      else next.add(kind);
      return next;
    });
    await toggleBookmark(profile.id, id, kind, active);
    setSavingBookmark(null);
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
    if (!id) return;
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
    if ((data ?? 0) >= 3) {
      window.alert("This route has been archived. Thanks for the heads up!");
      navigate("/", { replace: true });
    } else {
      window.alert(`Reported. ${data}/3 reports so far.`);
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
    const { error } = await supabase.from("routes").delete().eq("id", id);
    setDeleting(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  async function postComment() {
    if (!id || !profile || commentBody.trim().length === 0) return;
    setPostingComment(true);
    await supabase.from("comments").insert({
      route_id: id,
      user_id: profile.id,
      body: commentBody.trim(),
      is_beta: isBeta,
    });
    setCommentBody("");
    setIsBeta(false);
    await loadComments(id);
    setPostingComment(false);
  }

  async function upvote(c: CommentWithAuthor) {
    // Optimistic bump.
    setComments((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, upvotes: x.upvotes + 1 } : x)),
    );
    await supabase
      .from("comments")
      .update({ upvotes: c.upvotes + 1 })
      .eq("id", c.id);
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
        <CenterSpinner />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col items-center justify-center gap-4 border-x border-border bg-bg px-8">
        <p className="text-faint">Route not found.</p>
        <Button onClick={() => navigate("/")}>Back to feed</Button>
      </div>
    );
  }

  const grade = communityGrade(route.gradeValues);
  const visibleComments = comments.filter((c) => !blockedIds.has(c.user_id));

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      {/* Media + back. Video plays first (muted/looped) with the photo as poster. */}
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

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header: community grade hero */}
        <div className="flex items-center justify-between border-b border-border px-5 py-5">
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
            <p className="text-5xl font-extrabold leading-none text-accent">
              {formatGrade(grade, route.climbing_type, system)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {route.gradeValues.length} grade
              {route.gradeValues.length === 1 ? "" : "s"} · {route.sendCount}{" "}
              send{route.sendCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Save (project / to-try) + favorite */}
        <div className="flex gap-2 border-b border-border px-5 py-3">
          <button
            onClick={() => flipBookmark("project")}
            disabled={savingBookmark === "project"}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              bookmarks.has("project")
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-chalk"
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
            disabled={savingBookmark === "favorite"}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              bookmarks.has("favorite")
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-chalk"
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
          <p className="border-b border-border px-5 py-4 text-sm text-muted">
            {route.description}
          </p>
        ) : null}

        {/* Distribution */}
        <section className="border-b border-border px-5 py-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
            Grade distribution
          </h2>
          <GradeBar
            grades={route.gradeValues}
            climbingType={route.climbing_type}
            system={system}
          />
        </section>

        {/* Your grade */}
        <section className="border-b border-border px-5 py-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
            {myGrade === null ? "Submit your grade" : "Your grade"}
          </h2>
          <GradePicker
            value={draftGrade}
            onChange={setDraftGrade}
            climbingType={route.climbing_type}
            system={system}
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
        </section>

        {/* Send */}
        <section className="border-b border-border px-5 py-5">
          <Button
            className="w-full"
            variant={hasSent ? "secondary" : "primary"}
            loading={sending}
            disabled={hasSent}
            onClick={logSend}
          >
            {hasSent ? (
              <>
                <Check size={18} className="mr-2" /> Sent
              </>
            ) : (
              <>
                <Trophy size={18} className="mr-2" /> I sent this
              </>
            )}
          </Button>
        </section>

        {/* Comments / Beta */}
        <section className="px-5 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-faint">
            <MessageSquare size={15} /> Comments &amp; beta
          </h2>

          <div className="mb-4 flex flex-col gap-2">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Share beta or a comment…"
              className="min-h-[72px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-chalk placeholder:text-faint outline-none focus:border-accent"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsBeta((v) => !v)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  isBeta
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted hover:text-chalk"
                }`}
              >
                <Lightbulb size={15} /> Mark as beta
              </button>
              <Button
                onClick={postComment}
                loading={postingComment}
                disabled={commentBody.trim().length === 0}
                className="h-10 px-4"
              >
                Post
              </Button>
            </div>
          </div>

          {visibleComments.length === 0 ? (
            <p className="text-sm text-faint">
              No comments yet. Drop the first beta.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibleComments.map((c) => {
                const mine = c.user_id === profile?.id;
                return (
                  <li key={c.id}>
                    <Card className="p-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-chalk">
                          {c.authorName}
                        </span>
                        <div className="flex items-center gap-2">
                          {c.is_beta ? (
                            <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                              <Lightbulb size={11} /> Beta
                            </span>
                          ) : null}
                          {!mine ? (
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setMenuCommentId((prev) =>
                                    prev === c.id ? null : c.id,
                                  )
                                }
                                aria-label="Comment options"
                                className="rounded-full p-1 text-faint hover:text-chalk"
                              >
                                <MoreHorizontal size={16} />
                              </button>
                              {menuCommentId === c.id ? (
                                <div className="absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-card">
                                  <button
                                    onClick={() => {
                                      setMenuCommentId(null);
                                      setReportComment(c);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-chalk hover:bg-surface"
                                  >
                                    <Flag size={14} /> Report
                                  </button>
                                  <button
                                    onClick={() => blockClimber(c)}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-wide hover:bg-surface"
                                  >
                                    <Ban size={14} /> Block climber
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-sm text-muted">{c.body}</p>
                      <button
                        onClick={() => upvote(c)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-faint hover:text-accent"
                      >
                        <ThumbsUp size={14} /> {c.upvotes}
                      </button>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Route gone */}
        <div className="px-5 pb-8">
          <button
            onClick={reportGone}
            disabled={reporting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-wide/40 py-3 text-sm text-wide transition hover:bg-wide/10 disabled:opacity-50"
          >
            {reporting ? (
              <Spinner className="text-wide" />
            ) : (
              <>
                <Flag size={16} /> This route is gone
              </>
            )}
          </button>
          <p className="mt-2 text-center text-xs text-faint">
            {route.gone_reports}/3 reports
          </p>

          {/* Community flagging (wrong gym / duplicate / inappropriate) */}
          <button
            onClick={() => setReportOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-faint transition hover:text-wide"
          >
            <ShieldAlert size={16} /> Report this route
          </button>

          {profile?.id === route.created_by ? (
            othersEngaged ? (
              <p className="mt-4 text-center text-xs text-faint">
                Others have graded, sent, or commented on this route, so it
                can't be deleted. Use "This route is gone" to retire it.
              </p>
            ) : (
              <button
                onClick={deleteRoute}
                disabled={deleting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm text-faint transition hover:text-wide disabled:opacity-50"
              >
                {deleting ? (
                  <Spinner className="text-wide" />
                ) : (
                  <>
                    <Trash2 size={16} /> Delete this route
                  </>
                )}
              </button>
            )
          ) : null}
        </div>
      </div>

      {/* Report reasons sheet */}
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
                  className="w-full rounded-2xl border border-border bg-surface-2 py-3 text-sm font-semibold text-chalk transition hover:border-accent disabled:opacity-50"
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

      {/* Comment report reasons sheet */}
      {reportComment ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-lg font-bold text-chalk">Report comment</h3>
            <p className="mt-1 text-sm text-muted">
              Why are you reporting this? After 3 reports it's hidden pending
              review.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {CONTENT_REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  disabled={reportingComment}
                  onClick={() => submitCommentReport(r.value)}
                  className="w-full rounded-2xl border border-border bg-surface-2 py-3 text-sm font-semibold text-chalk transition hover:border-accent disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setReportComment(null)}
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

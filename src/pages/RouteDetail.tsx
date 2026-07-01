import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Ban,
  BarChart3,
  Bookmark,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Flag,
  Heart,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  ShieldAlert,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoute, type RouteWithStats } from "../lib/routes";
import { communityGrade, formatGrade, gradeConsensus } from "../lib/grades";
import {
  climbTypeLabel,
  CONTENT_REPORT_REASONS,
  holdHex,
  REPORT_REASONS,
} from "../lib/constants";
import type { ContentReason, ReportReason } from "../lib/constants";
import { fetchRouteBookmarks, toggleBookmark } from "../lib/bookmarks";
import { blockUser, fetchBlockedIds, reportContent } from "../lib/moderation";
import { Button, CenterSpinner } from "../components/ui";
import { Avatar } from "../components/Avatar";
import { GradeBar } from "../components/GradeBar";
import { GradeDonut } from "../components/GradeDonut";
import { GradePicker } from "../components/GradePicker";
import type { BookmarkKind, CommentRow as CommentR } from "../lib/database.types";

type CommentWithAuthor = CommentR & {
  authorName: string;
  authorAvatar: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
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
  const [sending, setSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [othersEngaged, setOthersEngaged] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportingRoute, setReportingRoute] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [hasReportedGone, setHasReportedGone] = useState(false);

  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [isBeta, setIsBeta] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Beta is a spoiler — hidden behind a blur until the user opts in.
  const [showBeta, setShowBeta] = useState(false);
  const [revealedBeta, setRevealedBeta] = useState<Set<string>>(new Set());

  const [bookmarks, setBookmarks] = useState<Set<BookmarkKind>>(new Set());
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
    const info = new Map<string, { name: string; avatar: string | null }>();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      for (const u of users ?? [])
        info.set(u.id, { name: u.display_name, avatar: u.avatar_url });
    }
    setComments(
      rows.map((c) => ({
        ...c,
        authorName: info.get(c.user_id)?.name ?? "Climber",
        authorAvatar: info.get(c.user_id)?.avatar ?? null,
      })),
    );
  }, []);

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

    const { count: mySendCount } = await supabase
      .from("sends")
      .select("*", { count: "exact", head: true })
      .eq("route_id", id)
      .eq("user_id", profile.id);
    setHasSent((mySendCount ?? 0) > 0);

    const { count: myGoneCount } = await supabase
      .from("gone_reports")
      .select("*", { count: "exact", head: true })
      .eq("route_id", id)
      .eq("user_id", profile.id);
    setHasReportedGone((myGoneCount ?? 0) > 0);

    await loadComments(id);
    setBookmarks(await fetchRouteBookmarks(profile.id, id));
    setBlockedIds(await fetchBlockedIds(profile.id));

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
    await supabase.from("sends").upsert(
      { route_id: id, user_id: profile.id },
      { onConflict: "route_id,user_id", ignoreDuplicates: true },
    );
    setHasSent(true);
    setRoute(await fetchRoute(id));
    setSending(false);
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
      setComments((prev) => prev.filter((x) => x.id !== target.id));
      window.alert("Thanks — this comment was hidden pending review.");
    } else {
      window.alert("Report submitted. Thanks for keeping Klimb clean.");
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

  async function submitComment() {
    if (!id || !profile || commentBody.trim().length === 0) return;
    setPostingComment(true);
    await supabase.from("comments").insert({
      route_id: id,
      user_id: profile.id,
      body: commentBody.trim(),
      is_beta: isBeta,
      parent_id: replyTo?.id ?? null,
    });
    setCommentBody("");
    setIsBeta(false);
    const wasReplyingTo = replyTo?.id;
    setReplyTo(null);
    await loadComments(id);
    if (wasReplyingTo)
      setExpanded((prev) => new Set(prev).add(wasReplyingTo));
    setPostingComment(false);
  }

  async function like(c: CommentWithAuthor) {
    if (liked.has(c.id)) return;
    setLiked((prev) => new Set(prev).add(c.id));
    setComments((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, upvotes: x.upvotes + 1 } : x)),
    );
    await supabase
      .from("comments")
      .update({ upvotes: c.upvotes + 1 })
      .eq("id", c.id);
  }

  function startReply(c: CommentWithAuthor) {
    setReplyTo({ id: c.parent_id ?? c.id, name: c.authorName });
    const el = document.getElementById("comment-input");
    el?.focus();
  }

  function toggleReplies(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  const { tone, count } = gradeConsensus(route.gradeValues);
  const visibleComments = comments.filter((c) => !blockedIds.has(c.user_id));
  const topLevel = visibleComments.filter((c) => !c.parent_id);
  const repliesOf = (parentId: string) =>
    visibleComments.filter((c) => c.parent_id === parentId);

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

  const renderComment = (c: CommentWithAuthor, isReply: boolean) => {
    const mine = c.user_id === profile?.id;
    const size = isReply ? 30 : 38;
    const betaHidden =
      c.is_beta && !showBeta && !revealedBeta.has(c.id) && !mine;
    return (
      <div className="flex gap-3">
        <Link to={`/u/${c.user_id}`} className="shrink-0">
          <Avatar name={c.authorName} url={c.authorAvatar} size={size} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-chalk">
            <Link to={`/u/${c.user_id}`} className="font-semibold hover:underline">
              {c.authorName}
            </Link>{" "}
            {betaHidden ? (
              <button
                onClick={() =>
                  setRevealedBeta((prev) => new Set(prev).add(c.id))
                }
                title="Tap to reveal beta"
                className="align-middle text-chalk/90"
              >
                <span className="select-none blur-[5px]">{c.body}</span>
                <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-accent blur-0">
                  <EyeOff size={10} /> beta · tap to reveal
                </span>
              </button>
            ) : (
              <span className="text-chalk/90">{c.body}</span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-faint">
            <span>{timeAgo(c.created_at)}</span>
            {c.is_beta ? (
              <span className="flex items-center gap-1 text-accent">
                <Lightbulb size={12} /> Beta
              </span>
            ) : null}
            {c.upvotes > 0 ? (
              <span>
                {c.upvotes} like{c.upvotes === 1 ? "" : "s"}
              </span>
            ) : null}
            <button
              onClick={() => startReply(c)}
              className="font-semibold hover:text-chalk"
            >
              Reply
            </button>
            {!mine ? (
              <div className="relative">
                <button
                  onClick={() =>
                    setMenuCommentId((p) => (p === c.id ? null : c.id))
                  }
                  aria-label="Options"
                  className="hover:text-chalk"
                >
                  <MoreHorizontal size={15} />
                </button>
                {menuCommentId === c.id ? (
                  <div className="absolute left-0 top-6 z-20 w-40 overflow-hidden rounded-xl border border-border bg-surface-2 shadow-card">
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
        <button
          onClick={() => like(c)}
          aria-label="Like"
          className="mt-1 shrink-0 text-faint transition hover:text-wide"
        >
          <Heart
            size={15}
            className={liked.has(c.id) ? "text-wide" : ""}
            fill={liked.has(c.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
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
              <p className="mt-0.5 text-4xl font-extrabold leading-none text-accent">
                {formatGrade(grade, route.climbing_type, system)}
              </p>
              <p className={`mt-1.5 text-xs font-semibold ${verdictClass}`}>
                {verdictLabel}
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Gym says
              </p>
              <p className="mt-0.5 text-4xl font-extrabold leading-none text-chalk">
                {route.gym_grade === null || route.gym_grade === undefined
                  ? "—"
                  : formatGrade(route.gym_grade, route.climbing_type, system)}
              </p>
              <p className="mt-1.5 text-xs text-faint">
                {route.gym_grade === null || route.gym_grade === undefined
                  ? "not set"
                  : "official grade"}
              </p>
            </div>
          </div>

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

          {/* Send */}
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

          {/* Comments — Instagram style */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-faint">
                <MessageCircle size={15} /> Comments
                {topLevel.length > 0 ? ` · ${topLevel.length}` : ""}
              </h2>
              {visibleComments.some((c) => c.is_beta) ? (
                <button
                  onClick={() => setShowBeta((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    showBeta
                      ? "bg-accent/15 text-accent"
                      : "bg-surface-2 text-muted hover:text-chalk"
                  }`}
                >
                  {showBeta ? <Eye size={14} /> : <EyeOff size={14} />}
                  {showBeta ? "Hide beta" : "Show beta"}
                </button>
              ) : null}
            </div>

            {topLevel.length === 0 ? (
              <p className="text-sm text-faint">
                No comments yet. Start the conversation.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {topLevel.map((c) => {
                  const replies = repliesOf(c.id);
                  const isOpen = expanded.has(c.id);
                  return (
                    <li key={c.id}>
                      {renderComment(c, false)}
                      {replies.length > 0 ? (
                        <div className="ml-[50px] mt-2">
                          <button
                            onClick={() => toggleReplies(c.id)}
                            className="flex items-center gap-2 text-xs font-semibold text-faint hover:text-muted"
                          >
                            <span className="h-px w-6 bg-border" />
                            {isOpen
                              ? "Hide replies"
                              : `View ${replies.length} ${
                                  replies.length === 1 ? "reply" : "replies"
                                }`}
                          </button>
                          {isOpen ? (
                            <ul className="mt-3 flex flex-col gap-3">
                              {replies.map((rc) => (
                                <li key={rc.id}>{renderComment(rc, true)}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

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

      {/* Sticky composer */}
      <div className="border-t border-border bg-bg px-4 py-2.5">
        {replyTo ? (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted">
            <span>
              Replying to <span className="text-chalk">{replyTo.name}</span>
            </span>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply">
              <X size={15} />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Avatar name={profile?.display_name} url={profile?.avatar_url} size={32} />
          <input
            id="comment-input"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitComment()}
            placeholder="Add a comment…"
            className="h-10 flex-1 rounded-full bg-surface-2 px-4 text-base text-chalk placeholder:text-faint outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => setIsBeta((v) => !v)}
            aria-label="Mark as beta"
            className={`rounded-full p-2 transition ${
              isBeta ? "text-accent" : "text-faint hover:text-chalk"
            }`}
          >
            <Lightbulb size={18} />
          </button>
          {commentBody.trim().length > 0 ? (
            <button
              onClick={submitComment}
              disabled={postingComment}
              className="shrink-0 px-2 text-sm font-bold text-accent disabled:opacity-50"
            >
              Post
            </button>
          ) : null}
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
                />
              </div>
            ) : null}
          </div>
        </div>
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
                  className="w-full rounded-2xl bg-surface-2 py-3 text-sm font-semibold text-chalk transition hover:ring-1 hover:ring-accent disabled:opacity-50"
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

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Ban, Bookmark, Check, ChevronLeft, ChevronRight, Clock, Flag, Lock, Stamp, UserPlus, UsersRound, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchRoutesByIds, type RouteWithStats } from "../lib/routes";
import type { GradeSystem } from "../lib/grades";
import {
  acceptFriendRequest,
  addFriendById,
  fetchMutualFriends,
  fetchProfileFriends,
  friendshipStatus,
  removeFriend,
  type FriendProfile,
  type FriendStatus,
  type MutualFriend,
} from "../lib/friends";
import { blockUser, reportContent, unblockUser } from "../lib/moderation";
import {
  CONTENT_REPORT_REASONS,
  type ContentReason,
} from "../lib/constants";
import { Avatar } from "../components/Avatar";
import { RouteCard } from "../components/RouteCard";
import { Button, CenterSpinner, ConfirmDialog } from "../components/ui";
import { ActivityReactions } from "../components/ActivityReactions";
import { normalizeStoredReaction, type ReactionCounts } from "../lib/reactions";
import { fetchProUserIds } from "../lib/proBadges";
import { ProBadge } from "../components/ProBadge";
import { ProfileBadge } from "../components/ProfileBadge";
import {
  fetchProfileBadges,
  type ProfileBadge as ProfileBadgeRecord,
} from "../lib/profileBadges";

type PubProfile = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  sends_public: boolean;
  projects_public: boolean;
  notes_public: boolean;
  friends_public: boolean;
  is_pro: boolean;
};

type ProfileActivityReaction = {
  kind: "send" | "project";
  sourceId: string;
  routeId: string;
  counts: ReactionCounts;
  mine: string | null;
};

type ProfileNavigationState = { person?: FriendProfile };

function profilePreview(person: FriendProfile): PubProfile {
  return {
    ...person,
    bio: null,
    notes_public: false,
  };
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const { profile: me } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromKlimbCode = new URLSearchParams(location.search).get("friendRequest") === "1";
  const system = me?.grade_system ?? "american";
  const meId = me?.id ?? null;
  const navigationPerson = (location.state as ProfileNavigationState | null)?.person;
  const preview = navigationPerson?.id === id ? navigationPerson : null;

  const [person, setPerson] = useState<PubProfile | null>(() =>
    preview ? profilePreview(preview) : null,
  );
  const [loading, setLoading] = useState(!preview);
  const [contentLoading, setContentLoading] = useState(true);
  const [relationshipReady, setRelationshipReady] = useState(false);
  const [specialBadge, setSpecialBadge] = useState<ProfileBadgeRecord | null>(null);
  const [sends, setSends] = useState<RouteWithStats[]>([]);
  const [flashes, setFlashes] = useState<RouteWithStats[]>([]);
  const [projects, setProjects] = useState<RouteWithStats[]>([]);
  const [personGrades, setPersonGrades] = useState<Map<string, number>>(
    new Map(),
  );
  const [visibleNotes, setVisibleNotes] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<"sends" | "flashes" | "projects">("sends");
  const [status, setStatus] = useState<FriendStatus>("none");
  const [mutuals, setMutuals] = useState<MutualFriend[]>([]);
  const [profileFriends, setProfileFriends] = useState<MutualFriend[]>([]);
  const [profileFriendsOpen, setProfileFriendsOpen] = useState(false);
  const [activityReactions, setActivityReactions] = useState<Map<string, ProfileActivityReaction>>(new Map());
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [unfriendOpen, setUnfriendOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<ContentReason>("inappropriate");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  const isMe = !!me && me.id === id;

  useEffect(() => {
    if (!id) return;
    let active = true;
    const cached = preview ? profilePreview(preview) : null;
    setPerson(cached);
    setLoading(!cached);
    setContentLoading(true);
    setRelationshipReady(meId === id);
    setSends([]);
    setFlashes([]);
    setProjects([]);
    setVisibleNotes(new Map());
    setMutuals([]);
    setProfileFriends([]);
    setProfileFriendsOpen(false);
    setActivityReactions(new Map());

    void (async () => {
      const profileRequest = supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, sends_public, projects_public, notes_public, friends_public")
        .eq("id", id)
        .maybeSingle();
      const gradesRequest = supabase
        .from("grades")
        .select("route_id, grade")
        .eq("user_id", id);
      const blockRequest = meId && meId !== id
        ? supabase
            .from("blocks")
            .select("blocker_id", { count: "exact", head: true })
            .eq("blocker_id", meId)
            .eq("blocked_id", id)
        : Promise.resolve({ count: 0 });
      const friendshipRequest = meId && meId !== id
        ? friendshipStatus(meId, id)
        : Promise.resolve<FriendStatus>("none");
      const mutualsRequest = meId && meId !== id
        ? fetchMutualFriends(id)
        : Promise.resolve<MutualFriend[]>([]);
      const profileFriendsRequest = fetchProfileFriends(id);

      const [profileResult, gradesResult, blockResult, nextStatus, nextMutuals, nextProfileFriends, proIds, badges] =
        await Promise.all([
          profileRequest,
          gradesRequest,
          blockRequest,
          friendshipRequest,
          mutualsRequest,
          profileFriendsRequest,
          fetchProUserIds([id]),
          fetchProfileBadges([id]),
        ]);
      if (!active) return;

      const loadedPerson = profileResult.data
        ? { ...profileResult.data, is_pro: proIds.has(id) } as PubProfile
        : null;
      const resolvedPerson = loadedPerson ?? cached;
      setPerson(resolvedPerson);
      setSpecialBadge(badges.get(id) ?? null);
      setPersonGrades(
        new Map((gradesResult.data ?? []).map((row) => [row.route_id, row.grade])),
      );
      const isBlocked = (blockResult.count ?? 0) > 0;
      setBlocked(isBlocked);
      setStatus(nextStatus);
      setMutuals(nextMutuals);
      setProfileFriends(nextProfileFriends);
      setRelationshipReady(true);
      if (!resolvedPerson || isBlocked) {
        setLoading(false);
        setContentLoading(false);
        return;
      }
      setLoading(false);

      const canSeeSends = resolvedPerson.sends_public || meId === id;
      const canSeeProjects = resolvedPerson.projects_public || meId === id;
      const canSeeNotes = resolvedPerson.notes_public || meId === id;
      const sendsRequest = canSeeSends
        ? (async () => {
            const { data: rows } = await supabase
              .from("sends")
              .select("id, route_id, send_type, note, created_at")
              .eq("user_id", id)
              .eq("profile_visible", true)
              .neq("send_type", "attempt")
              .order("created_at", { ascending: false });
            const sendRows = rows ?? [];
            return {
              rows: sendRows,
              routes: await fetchRoutesByIds(sendRows.map((row) => row.route_id)),
            };
          })()
        : Promise.resolve({ rows: [], routes: [] as RouteWithStats[] });
      const projectsRequest = canSeeProjects
        ? (async () => {
            const { data: rows } = await supabase
              .from("bookmarks")
              .select("id, route_id, created_at")
              .eq("user_id", id)
              .eq("kind", "project")
              .eq("profile_visible", true)
              .order("created_at", { ascending: false });
            const projectRows = rows ?? [];
            const projectIds = projectRows.map((row) => row.route_id);
            const [routes, notesResult] = await Promise.all([
              fetchRoutesByIds(projectIds),
              canSeeNotes && projectIds.length > 0
                ? supabase
                    .from("project_notes")
                    .select("route_id, body")
                    .eq("user_id", id)
                    .in("route_id", projectIds)
                : Promise.resolve({ data: [] }),
            ]);
            return { rows: projectRows, routes, notes: notesResult.data ?? [] };
          })()
        : Promise.resolve({
          routes: [] as RouteWithStats[],
          rows: [] as { id: string; route_id: string; created_at: string }[],
          notes: [] as { route_id: string; body: string }[],
          });

      const [sendData, projectData] = await Promise.all([
        sendsRequest,
        projectsRequest,
      ]);
      if (!active) return;
      const routeById = new Map(sendData.routes.map((route) => [route.id, route]));
      setSends(sendData.routes);
      setFlashes(
        sendData.rows
          .filter((row) => row.send_type === "flash")
          .map((row) => routeById.get(row.route_id))
          .filter((route): route is RouteWithStats => !!route),
      );
      setProjects(projectData.routes);
      if (canSeeNotes) {
        const notes = new Map<string, string>();
        for (const row of sendData.rows) {
          if (row.note?.trim()) notes.set(row.route_id, row.note);
        }
        for (const note of projectData.notes) {
          if (note.body.trim()) notes.set(note.route_id, note.body);
        }
        setVisibleNotes(notes);
      }
      const activityRows = [
        ...sendData.rows.map((row) => ({ kind: "send" as const, sourceId: row.id, routeId: row.route_id })),
        ...projectData.rows.map((row) => ({ kind: "project" as const, sourceId: row.id, routeId: row.route_id })),
      ];
      const reactionResult = activityRows.length
        ? await supabase
            .from("activity_reactions")
            .select("activity_kind, activity_id, reactor_id, reaction")
            .in("activity_id", activityRows.map((row) => row.sourceId))
        : { data: [] as { activity_kind: "send" | "project"; activity_id: string; reactor_id: string; reaction: string }[] };
      if (!active) return;
      const nextReactions = new Map<string, ProfileActivityReaction>();
      for (const activity of activityRows) {
        const key = `${activity.kind}:${activity.routeId}`;
        if (!nextReactions.has(key)) {
          nextReactions.set(key, { ...activity, counts: {}, mine: null });
        }
      }
      for (const row of reactionResult.data ?? []) {
        const reaction = normalizeStoredReaction(row.reaction);
        const activity = activityRows.find((item) => item.kind === row.activity_kind && item.sourceId === row.activity_id);
        if (!activity) continue;
        const summary = nextReactions.get(`${activity.kind}:${activity.routeId}`);
        if (!summary) continue;
        summary.counts[reaction] = (summary.counts[reaction] ?? 0) + 1;
        if (row.reactor_id === meId) summary.mine = reaction;
      }
      setActivityReactions(nextReactions);
      setContentLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, location.key, meId, preview]);

  // One button, four states: send request, cancel a sent request, accept an
  // incoming one, or remove an existing friend.
  async function onFriendAction() {
    if (!me || !id) return;
    // Removing an existing friend is a bigger deal — confirm it first.
    if (status === "friends") {
      setUnfriendOpen(true);
      return;
    }
    setBusy(true);
    if (status === "pending_out") {
      await removeFriend(me.id, id);
      setStatus("none");
    } else if (status === "pending_in") {
      await acceptFriendRequest(me.id, id);
      setStatus("friends");
    } else {
      await addFriendById(me.id, id);
      setStatus("pending_out");
    }
    setBusy(false);
  }

  async function confirmUnfriend() {
    if (!me || !id) return;
    setBusy(true);
    await removeFriend(me.id, id);
    setStatus("none");
    setBusy(false);
    setUnfriendOpen(false);
  }

  async function confirmBlock() {
    if (!me || !id) return;
    setBlockBusy(true);
    // Blocking severs any friendship/request between you.
    await removeFriend(me.id, id);
    await blockUser(me.id, id);
    setBlockBusy(false);
    setBlockOpen(false);
    setBlocked(true);
    setStatus("none");
    setSends([]);
    setProjects([]);
  }

  async function onUnblock() {
    if (!me || !id) return;
    setBlockBusy(true);
    await unblockUser(me.id, id);
    setBlockBusy(false);
    setBlocked(false);
  }

  async function submitReport() {
    if (!me || !id) return;
    setReportBusy(true);
    setReportMessage("");
    const { error } = await reportContent(
      "user",
      id,
      reportReason,
      reportNote.trim() || undefined,
    );
    setReportBusy(false);
    if (error) {
      setReportMessage(error);
      return;
    }
    setReportOpen(false);
    setReportNote("");
    setReportMessage("Report sent. Thanks for helping keep Klimb safe.");
  }

  async function reactToActivity(activity: ProfileActivityReaction, nextReaction: string) {
    if (!meId || !id || reactingId === activity.sourceId) return;
    const previous = activity;
    const removing = activity.mine === nextReaction;
    const mapKey = `${activity.kind}:${activity.routeId}`;
    setReactingId(activity.sourceId);
    setActivityReactions((current) => {
      const next = new Map(current);
      const counts = { ...activity.counts };
      if (activity.mine) counts[activity.mine] = Math.max(0, (counts[activity.mine] ?? 0) - 1);
      if (!removing) counts[nextReaction] = (counts[nextReaction] ?? 0) + 1;
      next.set(mapKey, { ...activity, counts, mine: removing ? null : nextReaction });
      return next;
    });
    const result = removing
      ? await supabase.from("activity_reactions").delete().eq("activity_kind", activity.kind).eq("activity_id", activity.sourceId).eq("reactor_id", meId)
      : await supabase.from("activity_reactions").upsert({
          activity_kind: activity.kind,
          activity_id: activity.sourceId,
          route_id: activity.routeId,
          activity_owner_id: id,
          reactor_id: meId,
          reaction: nextReaction,
        }, { onConflict: "activity_kind,activity_id,reactor_id" });
    if (result.error) {
      setActivityReactions((current) => new Map(current).set(mapKey, previous));
    }
    setReactingId(null);
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
        <CenterSpinner />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="mx-auto flex h-full max-w-app flex-col items-center justify-center gap-4 bg-bg px-8">
        <p className="text-faint">Climber not found.</p>
        <Button onClick={() => navigate("/")}>Back home</Button>
      </div>
    );
  }

  const canSeeSends = (person.sends_public || isMe) && !blocked;
  const canSeeProjects = (person.projects_public || isMe) && !blocked;

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-2 px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-muted transition hover:text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-chalk">Profile</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col items-center pt-2 text-center">
          <Avatar name={person.display_name} url={person.avatar_url} size={88} />
          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-chalk">
              {person.display_name}
            </h2>
            {person.is_pro ? <ProBadge /> : null}
          </div>
          {person.username ? (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              <p className="text-sm text-muted">@{person.username}</p>
              {specialBadge ? <ProfileBadge badge={specialBadge} /> : null}
            </div>
          ) : null}
          {person.bio ? (
            <p className="mt-2 max-w-xs whitespace-pre-line text-sm text-chalk/90">
              {person.bio}
            </p>
          ) : null}

          {fromKlimbCode && !isMe && me && !blocked ? (
            <div className="mt-4 w-full rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-left">
              <p className="text-sm font-bold text-accent">Klimb code scanned</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Send {firstName(person.display_name)} a friend request below.
              </p>
            </div>
          ) : null}

          {!isMe && mutuals.length > 0 ? (
            <div className="mt-4 flex max-w-full items-center gap-3 rounded-full border border-border/80 bg-surface px-3 py-2 text-left shadow-card">
              <div className="flex shrink-0 -space-x-2">
                {mutuals.slice(0, 3).map((mutual) => (
                  <button
                    key={mutual.id}
                    type="button"
                    onClick={() => navigate(`/u/${mutual.id}`)}
                    aria-label={`View ${mutual.display_name}`}
                    className="rounded-full ring-2 ring-surface transition active:scale-95"
                  >
                    <Avatar name={mutual.display_name} url={mutual.avatar_url} size={28} />
                  </button>
                ))}
              </div>
              <p className="min-w-0 truncate text-xs font-semibold text-muted">
                <UsersRound size={13} className="mr-1 inline text-accent" />
                {mutuals.length === 1
                  ? `Mutual friend: ${mutuals[0].display_name}`
                  : `${mutuals.length} mutual friends`}
              </p>
            </div>
          ) : null}

          {!isMe && me && !blocked && !relationshipReady ? (
            <div className="mt-4 h-11 w-36 animate-pulse rounded-2xl bg-surface-2" />
          ) : !isMe && me && !blocked ? (
            <Button
              variant={status === "none" || status === "pending_in" ? "primary" : "secondary"}
              className="mt-4 px-6"
              loading={busy}
              onClick={onFriendAction}
            >
              {status === "friends" ? (
                <>
                  <Check size={16} className="mr-1.5" /> Friends
                </>
              ) : status === "pending_out" ? (
                <>
                  <Clock size={16} className="mr-1.5" /> Requested
                </>
              ) : status === "pending_in" ? (
                <>
                  <Check size={16} className="mr-1.5" /> Accept request
                </>
              ) : (
                <>
                  <UserPlus size={16} className="mr-1.5" /> {fromKlimbCode ? "Send friend request" : "Add friend"}
                </>
              )}
            </Button>
          ) : null}
        </div>

        {blocked ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-surface p-6 text-center shadow-card">
            <Ban size={22} className="text-wide" />
            <p className="text-sm text-muted">
              You've blocked this climber. Their content is hidden from you.
            </p>
            <Button variant="secondary" loading={blockBusy} onClick={onUnblock}>
              Unblock
            </Button>
          </div>
        ) : (
          <>
            {/* Sends / Flashes / Projects — tap to switch the list below. */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <TabTile
                label="Sends"
                icon={Check}
                value={sends.length}
                loading={contentLoading}
                active={tab === "sends"}
                onClick={() => setTab("sends")}
              />
              <TabTile
                label="Flashes"
                icon={Zap}
                value={flashes.length}
                loading={contentLoading}
                active={tab === "flashes"}
                onClick={() => setTab("flashes")}
              />
              <TabTile
                label="Projects"
                icon={Bookmark}
                value={projects.length}
                loading={contentLoading}
                locked={!canSeeProjects}
                active={tab === "projects"}
                onClick={() => setTab("projects")}
              />
            </div>

            {canSeeSends ? (
              <button
                onClick={() => navigate(`/u/${id}/passport`)}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                  <Stamp size={18} style={{ color: "#ffc24b" }} /> View {firstName(person.display_name)}&apos;s passport
                </span>
                <ChevronRight size={18} className="text-faint" />
              </button>
            ) : null}

            <div className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-card">
              <button
                type="button"
                disabled={!person.friends_public && !isMe}
                onClick={() => setProfileFriendsOpen((open) => !open)}
                aria-expanded={profileFriendsOpen}
                className="flex w-full items-center justify-between px-4 py-4 text-left disabled:cursor-default"
              >
              <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
                {person.friends_public || isMe ? <UsersRound size={18} className="text-accent" /> : <Lock size={18} className="text-faint" />}
                {person.friends_public || isMe
                  ? `${firstName(person.display_name)}'s friends`
                  : "Friends list is private"}
              </span>
                {person.friends_public || isMe ? (
                  <ChevronRight size={18} className={`text-faint transition-transform ${profileFriendsOpen ? "rotate-90" : ""}`} />
                ) : null}
              </button>
              {(person.friends_public || isMe) && profileFriendsOpen ? (
              <div className="border-t border-border/70">
                {contentLoading ? (
                  <div className="space-y-2 px-4 py-4" aria-label="Loading friends">
                    <div className="h-11 animate-pulse rounded-xl bg-surface-2" />
                    <div className="h-11 animate-pulse rounded-xl bg-surface-2" />
                  </div>
                ) : profileFriends.length === 0 ? (
                  <p className="px-4 py-5 text-center text-sm text-faint">No friends to show yet.</p>
                ) : profileFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => navigate(`/u/${friend.id}`)}
                    className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 active:bg-surface-2"
                  >
                    <Avatar name={friend.display_name} url={friend.avatar_url} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-chalk">
                        <span className="truncate">{friend.display_name}</span>
                        {friend.is_pro ? <ProBadge compact /> : null}
                      </span>
                      {friend.username ? <span className="block truncate text-xs text-muted">@{friend.username}</span> : null}
                    </span>
                    <ChevronRight size={17} className="text-faint" />
                  </button>
                ))}
              </div>
              ) : null}
            </div>

            <div className="mt-6">
              {contentLoading ? (
                <div className="h-72 animate-pulse rounded-3xl bg-surface" />
              ) : tab === "projects" ? (
                !canSeeProjects ? (
                  <PrivateNote text="This climber's projects are private." />
                ) : projects.length === 0 ? (
                  <EmptyNote text="No open projects." />
                ) : (
                  <RouteList
                    routes={projects}
                    system={system}
                    grades={personGrades}
                    authorName={person.display_name}
                    gradePerspective={isMe ? "You" : "They"}
                    notes={visibleNotes}
                    reactionFor={(route) => activityReactions.get(`project:${route.id}`)}
                    reactingId={reactingId}
                    onReact={status === "friends" && !isMe ? reactToActivity : undefined}
                  />
                )
              ) : !canSeeSends ? (
                <PrivateNote text="This climber's logbook is private." />
              ) : tab === "flashes" ? (
                flashes.length === 0 ? (
                  <EmptyNote text="No flashes yet." />
                ) : (
                  <RouteList
                    routes={flashes}
                    system={system}
                    grades={personGrades}
                    authorName={person.display_name}
                    gradePerspective={isMe ? "You" : "They"}
                    notes={visibleNotes}
                    reactionFor={(route) => activityReactions.get(`send:${route.id}`)}
                    reactingId={reactingId}
                    onReact={status === "friends" && !isMe ? reactToActivity : undefined}
                  />
                )
              ) : sends.length === 0 ? (
                <EmptyNote text="No sends logged yet." />
              ) : (
                <RouteList
                  routes={sends}
                  system={system}
                  grades={personGrades}
                  authorName={person.display_name}
                  gradePerspective={isMe ? "You" : "They"}
                  notes={visibleNotes}
                  reactionFor={(route) => activityReactions.get(`send:${route.id}`)}
                  reactingId={reactingId}
                  onReact={status === "friends" && !isMe ? reactToActivity : undefined}
                />
              )}
            </div>

          </>
        )}

        {!isMe && me ? (
          <div className="mt-10 flex items-center justify-center gap-5">
            <button
              onClick={() => {
                setReportMessage("");
                setReportOpen(true);
              }}
              className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-faint transition hover:text-wide"
            >
              <Flag size={15} /> Report climber
            </button>
            {!blocked ? (
              <button
                onClick={() => setBlockOpen(true)}
                className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-faint transition hover:text-wide"
              >
                <Ban size={15} /> Block
              </button>
            ) : null}
          </div>
        ) : null}
        {reportMessage ? (
          <p className="mt-3 text-center text-xs text-muted" role="status">
            {reportMessage}
          </p>
        ) : null}
      </div>

      {reportOpen ? (
        <div
          className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
          onClick={() => setReportOpen(false)}
        >
          <div
            className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-chalk">Report climber</h3>
            <p className="mt-1 text-sm text-muted">
              Tell us what is wrong. Your report is private.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {CONTENT_REPORT_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-chalk"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason.value}
                    checked={reportReason === reason.value}
                    onChange={() => setReportReason(reason.value)}
                    className="accent-accent"
                  />
                  {reason.label}
                </label>
              ))}
            </div>
            <textarea
              value={reportNote}
              onChange={(event) => setReportNote(event.target.value)}
              maxLength={500}
              placeholder="Add details (optional)"
              className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-chalk placeholder:text-faint outline-none focus:border-accent"
            />
            {reportMessage ? (
              <p className="mt-2 text-sm text-wide" role="alert">
                {reportMessage}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="danger"
                className="w-full"
                loading={reportBusy}
                onClick={submitReport}
              >
                Send report
              </Button>
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

      <ConfirmDialog
        open={blockOpen}
        title={`Block ${person.display_name}?`}
        message="They'll be removed as a friend and their content will be hidden from you. You can unblock them anytime."
        confirmLabel="Block"
        variant="danger"
        onConfirm={confirmBlock}
        onCancel={() => setBlockOpen(false)}
      />

      <ConfirmDialog
        open={unfriendOpen}
        title={`Unfriend ${person.display_name}?`}
        message="You'll stop seeing each other's activity. You can always send another request later."
        confirmLabel="Unfriend"
        variant="danger"
        onConfirm={confirmUnfriend}
        onCancel={() => setUnfriendOpen(false)}
      />
    </div>
  );
}

function TabTile({
  label,
  icon: Icon,
  value,
  loading = false,
  locked = false,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Check;
  value: number;
  loading?: boolean;
  locked?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-4 shadow-card transition ${
        active ? "bg-accent/10 ring-1 ring-accent" : "bg-surface"
      }`}
    >
      <Icon size={16} className={active ? "text-accent" : "text-faint"} />
      <span className={`text-2xl font-extrabold ${active ? "text-accent" : "text-chalk"}`}>
        {loading ? (
          <span className="block h-7 w-8 animate-pulse rounded-lg bg-surface-2" />
        ) : locked ? (
          <Lock size={23} strokeWidth={2.4} aria-label="Private" />
        ) : (
          <span className="inline-block tabular-nums">{value}</span>
        )}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  );
}

function RouteList({
  routes,
  system,
  grades,
  authorName,
  gradePerspective,
  notes,
  reactionFor,
  reactingId,
  onReact,
}: {
  routes: RouteWithStats[];
  system: GradeSystem;
  grades: Map<string, number>;
  authorName: string;
  gradePerspective: "You" | "They";
  notes: Map<string, string>;
  reactionFor?: (route: RouteWithStats) => ProfileActivityReaction | undefined;
  reactingId?: string | null;
  onReact?: (activity: ProfileActivityReaction, reaction: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {routes.map((route, i) => {
        const reaction = reactionFor?.(route);
        return (
        <div key={`${route.id}:${i}`}>
          <RouteCard
            route={route}
            system={system}
            index={i}
            myGrade={grades.get(route.id) ?? null}
            authorName={authorName}
            gradePerspective={gradePerspective}
          />
          {notes.has(route.id) ? (
            <p className="-mt-5 rounded-b-3xl border-t border-border/60 bg-surface px-4 pb-4 pt-8 text-sm italic leading-relaxed text-muted">
              “{notes.get(route.id)}”
            </p>
          ) : null}
          {reaction && onReact ? (
            <div className="-mt-5 overflow-hidden rounded-b-3xl bg-surface pt-5">
              <ActivityReactions
                mine={reaction.mine}
                busy={reactingId === reaction.sourceId}
                onReact={(nextReaction) => onReact(reaction, nextReaction)}
              />
            </div>
          ) : null}
        </div>
      );})}
    </div>
  );
}

function PrivateNote({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-faint">
      <Lock size={22} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-faint">{text}</p>;
}

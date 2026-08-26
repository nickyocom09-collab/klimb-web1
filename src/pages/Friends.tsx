import { useDeferredValue, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Check, ChevronLeft, QrCode, Search, UsersRound, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { routeLabel } from "../lib/routeLabel";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchMutualFriendCounts,
  fetchPendingRequests,
  searchProfiles,
  type FriendProfile,
} from "../lib/friends";
import { Avatar } from "../components/Avatar";
import { CenterSpinner, Input } from "../components/ui";
import { friendInviteUrl } from "../lib/friendInvite";
import { ProBadge } from "../components/ProBadge";

export function Friends() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendProfile[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [matches, setMatches] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [mutualCounts, setMutualCounts] = useState<Map<string, number>>(new Map());

  // Light peek at what each (public) friend is climbing: their latest send
  // and how many projects they have open. No feed — just a subtitle.
  const [peeks, setPeeks] = useState<Map<string, string>>(new Map());

  async function loadPeeks(list: FriendProfile[]) {
    const ids = list.map((f) => f.id);
    if (ids.length === 0) return;
    const [{ data: sendsRows }, { data: bmRows }] = await Promise.all([
      supabase
        .from("sends")
        .select("user_id, route_id, created_at")
        .in("user_id", ids)
        .eq("profile_visible", true)
        .neq("send_type", "attempt")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("bookmarks")
        .select("user_id, route_id")
        .in("user_id", ids)
        .eq("kind", "project")
        .eq("profile_visible", true),
    ]);
    const latest = new Map<string, string>(); // user -> route_id
    for (const s of sendsRows ?? [])
      if (!latest.has(s.user_id)) latest.set(s.user_id, s.route_id);
    const projCount = new Map<string, number>();
    for (const b of bmRows ?? [])
      projCount.set(b.user_id, (projCount.get(b.user_id) ?? 0) + 1);
    const routeIds = [...new Set(latest.values())];
    const labelMap = new Map<string, string>();
    if (routeIds.length > 0) {
      const { data: rs } = await supabase
        .from("routes")
        .select("id, hold_color, name")
        .in("id", routeIds);
      for (const r of rs ?? [])
        labelMap.set(r.id, routeLabel(r));
    }
    const out = new Map<string, string>();
    for (const f of list) {
      const parts: string[] = [];
      const rid = latest.get(f.id);
      if (rid && labelMap.has(rid))
        parts.push(`Sent ${labelMap.get(rid)}`);
      const n = projCount.get(f.id) ?? 0;
      if (n > 0) parts.push(`projecting ${n}`);
      if (parts.length) out.set(f.id, parts.join(" · "));
    }
    setPeeks(out);
  }

  async function reload() {
    if (!profile) return;
    const [list, reqs] = await Promise.all([
      fetchFriends(profile.id),
      fetchPendingRequests(profile.id),
    ]);
    setFriends(list);
    setRequests(reqs);
    setLoading(false);
    void Promise.all([
      loadPeeks(list),
      fetchMutualFriendCounts(list.map((friend) => friend.id)).then(setMutualCounts),
    ]);
  }

  async function accept(otherId: string) {
    if (!profile) return;
    setActingOn(otherId);
    await acceptFriendRequest(profile.id, otherId);
    setActingOn(null);
    reload();
  }

  async function decline(otherId: string) {
    if (!profile) return;
    setActingOn(otherId);
    await declineFriendRequest(profile.id, otherId);
    setActingOn(null);
    setRequests((rs) => rs.filter((r) => r.id !== otherId));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Camera reliably recognizes HTTPS QR codes. The invite page then hands off
  // to the native profile deep link, including the signed-out login flow.
  useEffect(() => {
    if (!profile) return;
    const url = friendInviteUrl(profile.id);
    QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#0a0f0c", light: "#39FF88" },
    }).then(setQrUrl);
  }, [profile]);

  useEffect(() => {
    if (!profile || deferredQuery.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    setSearchError(null);
    void searchProfiles(deferredQuery, profile.id).then(({ people, error }) => {
      if (!active) return;
      setMatches(people);
      setSearchError(error ? "Search is having trouble. Try again." : null);
      setSearching(false);
      void fetchMutualFriendCounts(people.map((person) => person.id)).then((counts) => {
        if (!active) return;
        setMutualCounts((current) => new Map([...current, ...counts]));
      });
    });
    return () => {
      active = false;
    };
  }, [deferredQuery, profile]);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="flex items-center gap-3 px-5 pb-4 pt-5">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-95"
        >
          <ChevronLeft size={28} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-chalk">Your friends</h1>
          <p className="mt-1 text-xs font-semibold text-muted">Find and manage your circle</p>
        </div>
        <button
          onClick={() => setQrOpen(true)}
          aria-label="Show in-person QR code"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-chalk transition active:scale-95"
        >
          <QrCode size={18} />
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-8">
        {/* Search first, then inspect the profile before adding. */}
        <section className="order-1 rounded-3xl bg-surface p-4 shadow-card">
          <p className="mb-2 text-sm font-semibold text-chalk">
            Find a Klimber
          </p>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or @username"
              className="pl-10"
            />
          </div>
          {query.trim().length > 0 && query.trim().length < 2 ? (
            <p className="mt-2 text-xs text-faint">Type one more character.</p>
          ) : null}
          {searching ? <div className="py-4"><CenterSpinner /></div> : null}
          {!searching && matches.length > 0 ? (
            <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface-2/60">
              {matches.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/u/${person.id}`, { state: { person } })
                    }
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition duration-150 active:scale-[0.985] active:bg-accent/10"
                  >
                    <Avatar name={person.display_name} url={person.avatar_url} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-chalk">
                        <span className="truncate">{person.display_name}</span>
                        {person.is_pro ? <ProBadge compact /> : null}
                      </span>
                      {person.username ? <span className="block truncate text-xs text-muted">@{person.username}</span> : null}
                      {(mutualCounts.get(person.id) ?? 0) > 0 ? (
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-accent">
                          <UsersRound size={11} /> {mutualCounts.get(person.id)} mutual
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-bold text-accent">View</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searchError ? (
            <p className="py-5 text-center text-sm text-wide">{searchError}</p>
          ) : !searching && deferredQuery.trim().length >= 2 && matches.length === 0 ? (
            <p className="py-5 text-center text-sm text-faint">No Klimbers found.</p>
          ) : null}
        </section>

        {/* Incoming friend requests — accept or decline */}
        {requests.length > 0 ? (
          <section className="order-3">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
              Requests · {requests.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card"
                >
                  <Link to={`/u/${r.id}`} state={{ person: r }} className="shrink-0">
                    <Avatar name={r.display_name} url={r.avatar_url} size={44} />
                  </Link>
                  <Link to={`/u/${r.id}`} state={{ person: r }} className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1.5 font-semibold text-chalk">
                      <span className="truncate">{r.display_name}</span>
                      {r.is_pro ? <ProBadge compact /> : null}
                    </p>
                    {r.username ? (
                      <p className="truncate text-sm text-muted">@{r.username}</p>
                    ) : null}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => decline(r.id)}
                      disabled={actingOn === r.id}
                      aria-label={`Decline ${r.display_name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-faint transition hover:text-wide disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={() => accept(r.id)}
                      disabled={actingOn === r.id}
                      aria-label={`Accept ${r.display_name}`}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold text-bg transition active:scale-[0.97] disabled:opacity-50"
                    >
                      <Check size={16} /> Accept
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Friends sit directly below discovery, where the user expects them. */}
        <section className="order-2 mb-6 mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Friends {friends.length > 0 ? `· ${friends.length}` : ""}
          </h2>
          {loading ? (
            <CenterSpinner />
          ) : friends.length === 0 ? (
            <p className="rounded-3xl bg-surface px-5 py-8 text-center text-sm text-faint">
              No friends yet. Search for a Klimber above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {friends.map((f) => (
                <li key={f.id}>
                  <Link
                    to={`/u/${f.id}`}
                    state={{ person: f }}
                    className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
                  >
                    <Avatar name={f.display_name} url={f.avatar_url} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 font-semibold text-chalk">
                        <span className="truncate">{f.display_name}</span>
                        {f.is_pro ? <ProBadge compact /> : null}
                      </p>
                      {f.username ? <p className="truncate text-sm text-muted">@{f.username}</p> : null}
                      {peeks.has(f.id) ? <p className="truncate text-xs text-accent">{peeks.get(f.id)}</p> : null}
                      {(mutualCounts.get(f.id) ?? 0) > 0 ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted">
                          <UsersRound size={11} className="text-accent" /> {mutualCounts.get(f.id)} mutual
                        </p>
                      ) : null}
                    </div>
                    <span className="text-xs font-bold text-accent">View</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* QR sheet */}
      {qrOpen ? (
        <div
          className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-center justify-center bg-black/70 p-6"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full animate-scale-in rounded-3xl border border-border bg-surface p-6 text-center shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-chalk">Your Klimb code</h3>
              <button
                onClick={() => setQrOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-faint hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="Your QR code"
                className="mx-auto w-56 rounded-2xl"
              />
            ) : (
              <CenterSpinner />
            )}
            <p className="mt-4 text-sm text-muted">
              Scan with the iPhone camera. Klimb opens directly to your profile,
              where they can review it and tap Add friend.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

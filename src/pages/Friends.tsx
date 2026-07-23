import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Check, ChevronLeft, QrCode, UserPlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  acceptFriendRequest,
  addFriendByUsername,
  declineFriendRequest,
  fetchFriends,
  fetchPendingRequests,
  type FriendProfile,
} from "../lib/friends";
import { Avatar } from "../components/Avatar";
import { Button, CenterSpinner, Input } from "../components/ui";

export function Friends() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<FriendProfile[]>([]);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

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
        .neq("send_type", "attempt")
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("bookmarks")
        .select("user_id, route_id")
        .in("user_id", ids)
        .eq("kind", "project"),
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
        .select("id, hold_color, wall_section")
        .in("id", routeIds);
      for (const r of rs ?? [])
        labelMap.set(r.id, `${r.hold_color} · ${r.wall_section}`);
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
    loadPeeks(list);
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

  // Build the shareable QR: a link straight to your profile.
  useEffect(() => {
    if (!profile) return;
    const url = `${window.location.origin}/u/${profile.id}`;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#0a0f0c", light: "#39FF88" },
    }).then(setQrUrl);
  }, [profile]);

  async function add() {
    if (!profile) return;
    setAdding(true);
    setMsg(null);
    const { error, name } = await addFriendByUsername(profile.id, username);
    setAdding(false);
    if (error) {
      setMsgErr(true);
      setMsg(error);
      return;
    }
    setUsername("");
    setMsgErr(false);
    setMsg(`Friend request sent to ${name ?? "climber"}.`);
    reload();
  }

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
        <h1 className="text-xl font-extrabold text-chalk">Friends</h1>
        <button
          onClick={() => setQrOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-2 text-sm font-semibold text-chalk"
        >
          <QrCode size={16} /> My code
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* Add by username */}
        <div className="rounded-3xl bg-surface p-4 shadow-card">
          <p className="mb-2 text-sm font-semibold text-chalk">
            Add by username
          </p>
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button
              className="shrink-0 px-4"
              loading={adding}
              disabled={username.trim().length === 0}
              onClick={add}
            >
              <UserPlus size={18} />
            </Button>
          </div>
          {msg ? (
            <p className={`mt-2 text-sm ${msgErr ? "text-wide" : "text-accent"}`}>
              {msg}
            </p>
          ) : null}
          <button
            onClick={() => setQrOpen(true)}
            className="mt-3 text-sm text-muted underline"
          >
            or share your QR code
          </button>
        </div>

        {/* Incoming friend requests — accept or decline */}
        {requests.length > 0 ? (
          <>
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-faint">
              Requests · {requests.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card"
                >
                  <Link to={`/u/${r.id}`} className="shrink-0">
                    <Avatar name={r.display_name} url={r.avatar_url} size={44} />
                  </Link>
                  <Link to={`/u/${r.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-chalk">
                      {r.display_name}
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
          </>
        ) : null}

        {/* Friends list */}
        <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-faint">
          Your friends {friends.length > 0 ? `· ${friends.length}` : ""}
        </h2>
        {loading ? (
          <CenterSpinner />
        ) : friends.length === 0 ? (
          <p className="py-10 text-center text-sm text-faint">
            No friends yet. Add someone by username or share your code.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/u/${f.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card transition active:scale-[0.99]"
                >
                  <Avatar
                    name={f.display_name}
                    url={f.avatar_url}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-chalk">
                      {f.display_name}
                    </p>
                    {f.username ? (
                      <p className="truncate text-sm text-muted">
                        @{f.username}
                      </p>
                    ) : null}
                    {peeks.has(f.id) ? (
                      <p className="truncate text-xs text-accent">
                        {peeks.get(f.id)}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
              Have a friend scan this with their camera to open your profile and
              add you.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

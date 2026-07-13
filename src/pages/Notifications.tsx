import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  MessageCircle,
  Plus,
  Tag,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { ListSkeleton } from "../components/ui";
import {
  fetchNotifications,
  markNotificationsSeen,
  type Notification,
} from "../lib/notifications";
import { timeAgo } from "../lib/time";

function iconFor(kind: Notification["kind"]) {
  switch (kind) {
    case "reply":
      return { Icon: MessageCircle, tint: "accent" as const };
    case "grade":
      return { Icon: Tag, tint: "accent" as const };
    case "send":
      return { Icon: Trophy, tint: "gold" as const };
    case "friend_request":
    case "friend_accept":
      return { Icon: UserPlus, tint: "accent" as const };
    default:
      return { Icon: Plus, tint: "accent" as const };
  }
}

export function Notifications() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setLoading(true);
    (async () => {
      const list = await fetchNotifications(
        profile.id,
        profile.home_gym_id,
        profile.notifications_seen_at,
      );
      if (!active) return;
      setNotes(list);
      setLoading(false);
      markNotificationsSeen(profile.id);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  const groups = useMemo(() => {
    const fresh = notes.filter((n) => n.unread);
    const earlier = notes.filter((n) => !n.unread);
    return [
      { label: "New", items: fresh },
      { label: "Earlier", items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [notes]);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-bg/95 px-4 py-4 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-full p-1 text-chalk"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-extrabold text-chalk">Notifications</h1>
      </header>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : notes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 pb-24 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
            <Bell size={26} className="text-faint" />
          </span>
          <div>
            <p className="font-semibold text-chalk">You're all caught up</p>
            <p className="mt-1 text-sm text-faint">
              New routes at your gym, replies, grades on your routes, and
              friends show up here.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-5 py-3">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wide text-faint">
                {g.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {g.items.map((n) => {
                  const { Icon, tint } = iconFor(n.kind);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => navigate(n.link)}
                        className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left shadow-card transition active:scale-[0.99] ${
                          n.unread ? "bg-accent/10" : "bg-surface"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            tint === "gold" ? "" : "bg-accent/15 text-accent"
                          }`}
                          style={
                            tint === "gold"
                              ? {
                                  backgroundColor: "rgba(255,194,75,0.15)",
                                  color: "#ffc24b",
                                }
                              : undefined
                          }
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-chalk">
                            {n.text}
                          </p>
                          <p className="mt-0.5 text-xs text-faint">
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                        {n.unread ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

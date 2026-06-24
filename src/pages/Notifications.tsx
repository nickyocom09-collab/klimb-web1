import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, MessageCircle, Plus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { CenterSpinner } from "../components/ui";
import {
  fetchNotifications,
  markNotificationsSeen,
  type Notification,
} from "../lib/notifications";
import { timeAgo } from "../lib/time";

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
      // Clear the unread badge now that they're looking.
      markNotificationsSeen(profile.id);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <div className="mx-auto flex h-full max-w-app flex-col border-x border-border bg-bg">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-bg/95 px-4 py-4 backdrop-blur">
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
        <CenterSpinner />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-8 py-20 text-center">
          <Bell size={28} className="text-faint" />
          <p className="text-sm text-faint">
            You're all caught up. New routes and replies show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col overflow-y-auto">
          {notes.map((n) => {
            const Icon = n.kind === "reply" ? MessageCircle : Plus;
            return (
              <li key={n.id}>
                <button
                  onClick={() => navigate(`/route/${n.routeId}`)}
                  className={`flex w-full items-start gap-3 border-b border-border px-5 py-3.5 text-left transition hover:bg-surface ${
                    n.unread ? "bg-accent/5" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-chalk">{n.text}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {n.unread ? (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

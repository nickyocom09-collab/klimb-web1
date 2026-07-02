import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, Tag, Trophy } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { CenterSpinner } from "../components/ui";
import { fetchGymActivity, type ActivityEvent } from "../lib/activity";
import { formatGradeStyled, type GradeStyle } from "../lib/grades";
import { timeAgo } from "../lib/time";

const ICONS = {
  send: Trophy,
  grade: Tag,
  comment: MessageCircle,
  new_route: Plus,
} as const;

export function ActivityFeed() {
  const { profile } = useAuth();
  const gymId = profile?.home_gym_id ?? null;
  const system = profile?.grade_system ?? "american";
  const [gymName, setGymName] = useState<string | null>(null);
  const [gradeStyle, setGradeStyle] = useState<GradeStyle>("classic");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gymId) return;
    supabase
      .from("gyms")
      .select("name, grading_style")
      .eq("id", gymId)
      .maybeSingle()
      .then(({ data }) => {
        setGymName(data?.name ?? null);
        setGradeStyle(data?.grading_style ?? "classic");
      });
  }, [gymId]);

  useEffect(() => {
    if (!gymId) return;
    let active = true;
    setLoading(true);
    (async () => {
      let blocked = new Set<string>();
      if (profile?.id) {
        const { data } = await supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", profile.id);
        blocked = new Set((data ?? []).map((b) => b.blocked_id));
      }
      const evs = await fetchGymActivity(gymId, blocked);
      if (active) {
        setEvents(evs);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [gymId, profile?.id]);

  function phrase(e: ActivityEvent) {
    switch (e.kind) {
      case "send":
        return (
          <>
            sent <span className="font-semibold text-chalk">{e.routeLabel}</span>
          </>
        );
      case "grade":
        return (
          <>
            graded{" "}
            <span className="font-semibold text-chalk">{e.routeLabel}</span> at{" "}
            <span className="font-semibold text-accent">
              {formatGradeStyled(e.grade ?? null, e.climbingType, system, gradeStyle)}
            </span>
          </>
        );
      case "comment":
        return (
          <>
            left beta on{" "}
            <span className="font-semibold text-chalk">{e.routeLabel}</span>
          </>
        );
      case "new_route":
        return (
          <>
            added a new route —{" "}
            <span className="font-semibold text-chalk">{e.routeLabel}</span>
          </>
        );
    }
  }

  return (
    <div>
      <AppHeader title="Activity" subtitle={gymName ?? "your gym"} />

      {loading ? (
        <CenterSpinner />
      ) : events.length === 0 ? (
        <div className="px-8 py-16 text-center text-faint">
          No activity yet. Be the first to send something.
        </div>
      ) : (
        <ul className="flex flex-col">
          {events.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li
                key={e.id}
                style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}
                className="animate-fade-up"
              >
                <Link
                  to={`/route/${e.routeId}`}
                  className="flex items-start gap-3 border-b border-border px-5 py-3.5 transition hover:bg-surface"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-muted">
                      <span className="font-semibold text-chalk">
                        {e.actor}
                      </span>{" "}
                      {phrase(e)}
                    </p>
                    <p className="mt-0.5 text-xs text-faint">
                      {timeAgo(e.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

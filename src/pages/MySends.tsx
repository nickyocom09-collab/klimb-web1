import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { communityGrade, formatGrade } from "../lib/grades";
import { holdHex } from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { CenterSpinner, Spinner } from "../components/ui";
import type { RouteRow } from "../lib/database.types";

type SendEntry = {
  sendId: string;
  sentAt: string;
  route: RouteRow;
  grade: number | null;
};

export function MySends() {
  const { profile } = useAuth();
  const system = profile?.grade_system ?? "american";
  const [entries, setEntries] = useState<SendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  async function removeSend(sendId: string) {
    if (
      !window.confirm(
        "Remove this send from your logbook? This only affects your personal log — the route stays up for everyone else.",
      )
    )
      return;
    setRemoving(sendId);
    // `.select()` returns the deleted rows. If RLS blocks the delete, the call
    // still returns 200 but with an empty array — so check we actually removed
    // a row rather than trusting the absence of an error.
    const { data, error } = await supabase
      .from("sends")
      .delete()
      .eq("id", sendId)
      .select();
    setRemoving(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    if (!data || data.length === 0) {
      window.alert(
        "Couldn't remove this send — the database is missing a delete permission for sends. Add an RLS policy allowing users to delete their own sends.",
      );
      return;
    }
    setEntries((prev) => prev.filter((e) => e.sendId !== sendId));
  }

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: sends } = await supabase
        .from("sends")
        .select("id, route_id, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      const rows = sends ?? [];
      const routeIds = [...new Set(rows.map((s) => s.route_id))];
      const routeMap = new Map<string, RouteRow>();
      const gradeMap = new Map<string, number[]>();

      if (routeIds.length > 0) {
        const [{ data: routes }, { data: grades }] = await Promise.all([
          supabase.from("routes").select("*").in("id", routeIds),
          supabase.from("grades").select("route_id, grade").in("route_id", routeIds),
        ]);
        for (const r of routes ?? []) routeMap.set(r.id, r);
        for (const g of grades ?? []) {
          const arr = gradeMap.get(g.route_id) ?? [];
          arr.push(g.grade);
          gradeMap.set(g.route_id, arr);
        }
      }

      const built: SendEntry[] = rows
        .map((s) => {
          const route = routeMap.get(s.route_id);
          if (!route) return null;
          return {
            sendId: s.id,
            sentAt: s.created_at,
            route,
            grade: communityGrade(gradeMap.get(s.route_id) ?? []),
          };
        })
        .filter((e): e is SendEntry => e !== null);

      if (active) {
        setEntries(built);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  return (
    <div>
      <AppHeader title="My Sends" subtitle={`${entries.length} logged`} />
      {loading ? (
        <CenterSpinner />
      ) : entries.length === 0 ? (
        <p className="px-8 py-16 text-center text-faint">
          No sends logged yet. Tap "I sent this" on a route to start your log.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 p-5">
          {entries.map((e, i) => (
            <li
              key={e.sendId}
              style={{ animationDelay: `${Math.min(i * 45, 270)}ms` }}
              className="flex animate-fade-up items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-card"
            >
              <Link
                to={`/route/${e.route.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 transition active:scale-[0.99]"
              >
                <img
                  src={e.route.photo_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-white/10"
                      style={{ backgroundColor: holdHex(e.route.hold_color) }}
                    />
                    <span className="truncate font-semibold text-chalk">
                      {e.route.hold_color} · {e.route.wall_section}
                    </span>
                    {e.route.status === "archived" ? (
                      <Archive size={13} className="text-faint" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(e.sentAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-2xl font-extrabold text-accent">
                  {formatGrade(e.grade, e.route.climbing_type, system)}
                </span>
              </Link>
              <button
                onClick={() => removeSend(e.sendId)}
                disabled={removing === e.sendId}
                aria-label="Remove from logbook"
                className="shrink-0 rounded-full p-2 text-faint transition hover:text-wide disabled:opacity-50"
              >
                {removing === e.sendId ? (
                  <Spinner className="text-wide" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { Bookmark, Check, MapPinOff, Zap } from "lucide-react";
import type { PersonalLogRow } from "../lib/database.types";
import { offGridRoute } from "../lib/personalLogs";
import type { GradeSystem } from "../lib/grades";
import { holdHex } from "../lib/constants";
import { routeLabel } from "../lib/routeLabel";
import { RouteGradeStack } from "./RouteGradeStack";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The off-grid group in the logbook: climbs saved to the user with no gym yet.
 * Clearly labelled and explained, kept apart from gym-linked sends, and never
 * linked out (these routes don't exist in any gym until they're transferred).
 */
export function OffGridSection({
  logs,
  system,
  action,
}: {
  logs: PersonalLogRow[];
  system: GradeSystem;
  /** Optional trailing control, e.g. a "Transfer to my gym" button. */
  action?: React.ReactNode;
}) {
  if (logs.length === 0) return null;
  return (
    <section>
      <div className="mb-1.5 ml-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-faint">
          <MapPinOff size={14} className="text-accent" /> Off-grid
        </h2>
        {action}
      </div>
      <p className="mb-3 ml-1 text-xs text-muted">
        Not tied to a gym yet. Transfer them when your gym is added.
      </p>
      <ul className="flex flex-col gap-2">
        {logs.map((pl) => {
          const route = offGridRoute(pl);
          return (
            <li
              key={pl.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card"
            >
              <img
                src={route.photo_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-chalk">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                    style={{ backgroundColor: holdHex(route.hold_color) }}
                  />
                  <span className="truncate">{routeLabel(route)}</span>
                  <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                    Off-grid
                  </span>
                </p>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                    {pl.outcome === "flash" ? (
                      <>
                        <Zap size={11} /> Flash
                      </>
                    ) : pl.outcome === "project" ? (
                      <>
                        <Bookmark size={11} /> Project
                      </>
                    ) : (
                      <>
                        <Check size={11} /> Send
                      </>
                    )}
                  </span>
                  <span className="min-w-0 truncate whitespace-nowrap text-xs text-muted">
                    {fmt(pl.created_at)}
                  </span>
                </div>
                {pl.note ? (
                  <p className="mt-1 truncate text-xs italic text-faint">
                    "{pl.note}"
                  </p>
                ) : null}
              </div>
              <RouteGradeStack
                route={route}
                system={system}
                userGrade={pl.felt_grade}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

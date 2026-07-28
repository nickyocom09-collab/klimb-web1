import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Video } from "lucide-react";
import { formatGradeStyled, type GradeSystem } from "../lib/grades";
import { holdHex } from "../lib/constants";
import { routeLabel } from "../lib/routeLabel";
import type { RouteWithStats } from "../lib/routes";
import { RouteGradeStack } from "./RouteGradeStack";

export function RouteCard({
  route,
  system = "american",
  index = 0,
  myGrade = null,
  authorName = null,
  gradePerspective,
  onGrade,
}: {
  route: RouteWithStats;
  system?: GradeSystem;
  index?: number;
  myGrade?: number | null;
  authorName?: string | null;
  gradePerspective?: "You" | "They";
  onGrade?: (route: RouteWithStats) => void;
}) {
  // The climber's own grade for this route (their logbook entry), shown next
  // to the gym's grade — no crowd aggregation.
  const fmt = (g: number | null) =>
    formatGradeStyled(g, route.climbing_type, system, route.gradingStyle);
  return (
    <div
      style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
      className="animate-fade-up overflow-hidden rounded-3xl bg-surface shadow-card"
    >
      <Link to={`/route/${route.id}`} className="block transition active:scale-[0.99]">
        {/* Author strip */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-bold uppercase text-accent">
            {(authorName ?? "?").charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-chalk">
              {authorName ?? "Climber"}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              {routeLabel(route)}
            </p>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-surface-2">
          <FadeImg
            src={route.photo_url}
            alt={routeLabel(route)}
          />
          {route.video_url ? (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 backdrop-blur">
              <Video size={13} className="text-chalk" />
            </span>
          ) : null}
        </div>

        <div className="p-4">
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Grade
              </p>
              <RouteGradeStack
                route={route}
                system={system}
                userGrade={myGrade}
                perspective={gradePerspective === "They" ? "They" : "You"}
              />
            </div>
          </div>
        </div>
      </Link>

      {onGrade ? (
        <button
          onClick={() => onGrade(route)}
          className={`flex w-full items-center justify-center gap-2 border-t border-border/60 py-3 text-sm font-semibold transition ${
            myGrade !== null
              ? "text-accent hover:bg-accent/5"
              : "text-muted hover:text-chalk"
          }`}
        >
          {myGrade !== null ? (
            <>
              <Check size={16} /> You said{" "}
              <span className="klimb-grade">{fmt(myGrade)}</span> · change
            </>
          ) : (
            <>
              <Plus size={16} /> Add your grade
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

/** Blur-up image: soft placeholder surface, then the photo fades in. */
function FadeImg({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition-[opacity,filter] duration-500 ${
        loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
      }`}
    />
  );
}

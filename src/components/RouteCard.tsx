import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, Video } from "lucide-react";
import { formatGradeStyled, formatGymGrade, type GradeSystem } from "../lib/grades";
import { holdHex } from "../lib/constants";
import type { RouteWithStats } from "../lib/routes";

export function RouteCard({
  route,
  system = "american",
  index = 0,
  myGrade = null,
  authorName = null,
  onGrade,
}: {
  route: RouteWithStats;
  system?: GradeSystem;
  index?: number;
  myGrade?: number | null;
  authorName?: string | null;
  onGrade?: (route: RouteWithStats) => void;
}) {
  // The climber's own grade for this route (their logbook entry), shown next
  // to the gym's grade — no crowd aggregation.
  const theirGrade = myGrade;
  const fmt = (g: number | null) =>
    formatGradeStyled(g, route.climbing_type, system, route.gradingStyle);
  const saysLabel = authorName ? `${authorName} says` : "Grade";

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
              {route.hold_color} · {route.wall_section}
            </p>
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full bg-surface-2">
          <FadeImg
            src={route.photo_url}
            alt={`${route.hold_color} route on ${route.wall_section}`}
          />
          {route.video_url ? (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 backdrop-blur">
              <Video size={13} className="text-chalk" />
            </span>
          ) : null}
        </div>

        <div className="p-4">
          {/* Their grade (+ the gym's grade, when the gym set one) */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-surface-2 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {saysLabel}
              </p>
              <p className="mt-0.5 text-3xl font-extrabold leading-none text-accent">
                {fmt(theirGrade)}
              </p>
            </div>
            {route.gym_grade !== null && route.gym_grade !== undefined ? (
              <div className="flex-1 rounded-2xl bg-surface-2 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Gym says
                </p>
                <p className="mt-0.5 text-3xl font-extrabold leading-none text-chalk">
                  {formatGymGrade(
                    route.gym_grade,
                    route.climbing_type,
                    system,
                    route.gradingStyle,
                  )}
                </p>
              </div>
            ) : null}
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
              <Check size={16} /> You said {fmt(myGrade)} · change
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

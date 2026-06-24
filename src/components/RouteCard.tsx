import { Link } from "react-router-dom";
import { Trophy, Users, Video } from "lucide-react";
import { communityGrade, formatGrade, type GradeSystem } from "../lib/grades";
import { holdHex } from "../lib/constants";
import type { RouteWithStats } from "../lib/routes";

export function RouteCard({
  route,
  system = "american",
  index = 0,
}: {
  route: RouteWithStats;
  system?: GradeSystem;
  index?: number;
}) {
  const grade = communityGrade(route.gradeValues);

  return (
    <Link
      to={`/route/${route.id}`}
      style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}
      className="block animate-fade-up overflow-hidden rounded-3xl border border-border bg-surface shadow-card transition duration-200 hover:border-faint active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full bg-surface-2">
        <img
          src={route.photo_url}
          alt={`${route.hold_color} route on ${route.wall_section}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Video indicator */}
        {route.video_url ? (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 backdrop-blur">
            <Video size={13} className="text-chalk" />
          </div>
        ) : null}
        {/* Community grade — the most prominent element. */}
        <div className="absolute right-3 top-3 flex flex-col items-center rounded-2xl bg-bg/80 px-3 py-1.5 backdrop-blur">
          <span className="text-3xl font-extrabold leading-none text-accent">
            {formatGrade(grade, route.climbing_type, system)}
          </span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
            community
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white/10"
            style={{ backgroundColor: holdHex(route.hold_color) }}
          />
          <div>
            <p className="font-semibold text-chalk">{route.hold_color}</p>
            <p className="text-sm text-muted">{route.wall_section}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Users size={15} />
            {route.gradeValues.length}
          </span>
          <span className="flex items-center gap-1">
            <Trophy size={15} />
            {route.sendCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

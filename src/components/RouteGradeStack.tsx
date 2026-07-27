import { climbTypeLabel } from "../lib/constants";
import {
  formatGradeStyled,
  type GradeSystem,
} from "../lib/grades";
import type { RouteWithStats } from "../lib/routes";

/**
 * One consistent grade hierarchy for logbook/profile route rows.
 *
 * The setter's grade always owns the headline. Until the setter adds one,
 * "Not graded" stays in that position and the climber's estimate is clearly
 * presented as a smaller personal take underneath.
 */
export function RouteGradeStack({
  route,
  system,
  userGrade = null,
  perspective = "You",
}: {
  route: RouteWithStats;
  system: GradeSystem;
  userGrade?: number | null;
  perspective?: "You" | "They";
}) {
  const hasOfficialGrade =
    route.gym_grade !== null && route.gym_grade !== undefined;

  return (
    <div className="min-w-[5.5rem] shrink-0 text-right">
      {hasOfficialGrade ? (
        <p className="klimb-grade text-lg font-extrabold leading-none text-accent">
          {formatGradeStyled(
            route.gym_grade,
            route.climbing_type,
            system,
            route.gradingStyle,
          )}
        </p>
      ) : (
        <>
          <p className="text-sm font-extrabold leading-none text-accent">
            Not graded
          </p>
          {userGrade !== null && userGrade !== undefined ? (
            <p className="mt-1 text-[10px] font-semibold leading-none text-muted">
              {perspective} say{" "}
              <span className="klimb-grade font-bold text-chalk">
                {formatGradeStyled(
                  userGrade,
                  route.climbing_type,
                  system,
                  route.gradingStyle,
                )}
              </span>
            </p>
          ) : null}
        </>
      )}
      <p className="mt-1 text-[10px] leading-none text-faint">
        {climbTypeLabel(route.climbing_type)}
      </p>
    </div>
  );
}

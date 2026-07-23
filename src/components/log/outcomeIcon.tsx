import { Bookmark, Check, Flag, Zap } from "lucide-react";
import type { Outcome } from "../../lib/useLogClimb";

/** Icon for each outcome — kept out of the (non-JSX) useLogClimb hook. */
export const OUTCOME_ICON: Record<Outcome, typeof Zap> = {
  flash: Zap,
  send: Check,
  topped: Flag,
  project: Bookmark,
};

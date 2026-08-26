import { Mountain } from "lucide-react";
import type { ProfileBadge as ProfileBadgeRecord } from "../lib/profileBadges";

export function ProfileBadge({
  badge,
  compact = false,
}: {
  badge: ProfileBadgeRecord;
  compact?: boolean;
}) {
  return (
    <span
      title={badge.label}
      aria-label={badge.label}
      className={`inline-flex shrink-0 items-center rounded-full border border-amber-300/35 bg-amber-300/10 font-black text-amber-200 ${
        compact ? "gap-1 px-1.5 py-0.5 text-[9px]" : "gap-1.5 px-2 py-1 text-[10px]"
      }`}
    >
      <Mountain aria-hidden size={compact ? 11 : 13} strokeWidth={2.7} />
      {badge.label}
    </span>
  );
}

// Preset hold colors with a swatch for the UI.
export const HOLD_COLORS: { name: string; hex: string }[] = [
  { name: "Yellow", hex: "#FFD23F" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Red", hex: "#EF4444" },
  { name: "Green", hex: "#22C55E" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Orange", hex: "#F97316" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "White", hex: "#F5F5F2" },
  { name: "Teal", hex: "#14B8A6" },
];

export function holdHex(name: string): string {
  return HOLD_COLORS.find((c) => c.name === name)?.hex ?? "#9A9AA2";
}

// Climbing type ------------------------------------------------------------
// Two umbrellas: rope (top rope + lead) and non-rope (boulder).
export type ClimbType = "boulder" | "toprope" | "lead";

// Is this a rope discipline? (drives grade scale + outcomes)
export function isRopeType(t: ClimbType): boolean {
  return t === "toprope" || t === "lead";
}

export const CLIMB_TYPES: { value: ClimbType; label: string }[] = [
  { value: "boulder", label: "Boulder" },
  { value: "toprope", label: "Top Rope" },
  { value: "lead", label: "Lead" },
];

export function climbTypeLabel(t: ClimbType): string {
  if (t === "toprope") return "Top Rope";
  if (t === "lead") return "Lead";
  return "Boulder";
}

// Feed filter (adds "All" on top of the climbing types) --------------------
export type ClimbFilter = "all" | ClimbType;

export const CLIMB_FILTERS: { value: ClimbFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "boulder", label: "Boulder" },
  { value: "toprope", label: "Top Rope" },
  { value: "lead", label: "Lead" },
];

// Preferences --------------------------------------------------------------
// Note: the stored value is still "european" for back-compat; the label shown
// to users is "International" (the correct name for the Font/French scales).
export type GradeSystemPref = "american" | "european";
export type ThemePref = "dark" | "light";

export const GRADE_SYSTEMS: { value: GradeSystemPref; label: string }[] = [
  { value: "american", label: "American" },
  { value: "european", label: "International" },
];

export const THEMES: { value: ThemePref; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

// Log flow style — one long scrollable form, or a stepped one-at-a-time flow.
export type LogStylePref = "scroll" | "steps";

export const LOG_STYLES: { value: LogStylePref; label: string }[] = [
  { value: "steps", label: "Step by step" },
  { value: "scroll", label: "Single screen" },
];

// Instagram Stories direct-share --------------------------------------------
// Facebook App ID used for the "source_application" param when handing an
// image straight to Instagram's Stories composer (see instagramStories.ts).
// Free to create at developers.facebook.com — no app review needed for this
// feature. Leave blank to fall back to the generic OS share sheet.
export const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID ?? "";

// Media uploads ------------------------------------------------------------
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const MAX_ROUTES_PER_DAY = 10;

// Route report reasons -----------------------------------------------------
export type ReportReason = "wrong_gym" | "duplicate" | "inappropriate";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "wrong_gym", label: "Wrong gym" },
  { value: "duplicate", label: "Duplicate" },
  { value: "inappropriate", label: "Inappropriate" },
];

// Content report reasons (comments / users) --------------------------------
export type ContentReason =
  | "spam"
  | "inappropriate"
  | "harassment"
  | "wrong_info"
  | "other";

export const CONTENT_REPORT_REASONS: { value: ContentReason; label: string }[] =
  [
    { value: "spam", label: "Spam" },
    { value: "inappropriate", label: "Inappropriate" },
    { value: "harassment", label: "Harassment or abuse" },
    { value: "wrong_info", label: "Wrong information" },
    { value: "other", label: "Something else" },
  ];

import { useState } from "react";
import { Bookmark, Check, X, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { toggleBookmark } from "../lib/bookmarks";
import type { RouteWithStats } from "../lib/routes";
import type { SendType } from "../lib/database.types";
import { Button } from "./ui";
import { GradePicker } from "./GradePicker";

export type LogOutcome = "flash" | "send" | "project";

const OUTCOMES: {
  value: LogOutcome;
  label: string;
  hint: string;
  Icon: typeof Zap;
}[] = [
  { value: "flash", label: "Flash", hint: "First try", Icon: Zap },
  { value: "send", label: "Send", hint: "Topped it", Icon: Check },
  { value: "project", label: "Project", hint: "Working on it", Icon: Bookmark },
];

/**
 * THE log sheet — the one way to log a climb everywhere in the app (Log tab
 * and route page both open this). Flash/Send writes a sends row with the
 * note; Project bookmarks the route instead. An optional felt grade feeds
 * the community grade either way.
 */
export function LogSheet({
  route,
  onClose,
  onSaved,
}: {
  route: RouteWithStats;
  onClose: () => void;
  /** Called after a successful save with the chosen outcome. */
  onSaved: (outcome: LogOutcome) => void;
}) {
  const { profile } = useAuth();
  const system = profile?.grade_system ?? "american";

  const [outcome, setOutcome] = useState<LogOutcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile || !outcome) return;
    setSaving(true);

    // A felt grade feeds the community grade no matter the outcome.
    if (feltGrade !== null) {
      await supabase.from("grades").upsert(
        {
          route_id: route.id,
          user_id: profile.id,
          grade: feltGrade,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "route_id,user_id" },
      );
    }

    if (outcome === "project") {
      // Not sent yet — put it on the project board, no send row.
      await toggleBookmark(profile.id, route.id, "project", false);
    } else {
      const trimmed = note.trim();
      await supabase.from("sends").upsert(
        {
          route_id: route.id,
          user_id: profile.id,
          send_type: outcome as SendType,
          note: trimmed.length ? trimmed : null,
        },
        { onConflict: "route_id,user_id" },
      );
    }

    setSaving(false);
    onSaved(outcome);
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
      <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
        {/* Route header */}
        <div className="mb-4 flex items-center gap-3">
          <img
            src={route.photo_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold text-chalk">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(route.hold_color) }}
              />
              <span className="truncate">{route.hold_color}</span>
            </p>
            <p className="truncate text-sm text-muted">
              {route.wall_section} · {climbTypeLabel(route.climbing_type)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-faint transition hover:text-chalk"
          >
            <X size={22} />
          </button>
        </div>

        {/* Outcome */}
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map(({ value, label, hint, Icon }) => {
            const on = outcome === value;
            return (
              <button
                key={value}
                onClick={() => setOutcome(value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-3 transition ${
                  on
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface-2 text-muted hover:text-chalk"
                }`}
              >
                <Icon size={20} />
                <span className="text-sm font-bold">{label}</span>
                <span className="text-[10px] text-faint">{hint}</span>
              </button>
            );
          })}
        </div>

        {/* Felt grade */}
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Felt grade
            <span className="ml-1 font-normal normal-case text-faint">
              (optional)
            </span>
          </h3>
          <GradePicker
            value={feltGrade}
            onChange={setFeltGrade}
            climbingType={route.climbing_type}
            system={system}
            gradeStyle={route.gradingStyle}
          />
        </div>

        {/* Note */}
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional) — how'd it feel?"
            maxLength={280}
            className="min-h-[60px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
        </div>

        <Button
          className="mt-4 w-full"
          disabled={!outcome}
          loading={saving}
          onClick={save}
        >
          {outcome === "project" ? "Save to projects" : "Log it"}
        </Button>
      </div>
    </div>
  );
}

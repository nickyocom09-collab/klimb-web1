import { useRef, useState } from "react";
import {
  Bookmark,
  Camera,
  Check,
  Minus,
  Plus,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { climbTypeLabel, holdHex } from "../lib/constants";
import { toggleBookmark } from "../lib/bookmarks";
import { communityGrade, formatGradeStyled } from "../lib/grades";
import type { RouteWithStats } from "../lib/routes";
import type { SendType } from "../lib/database.types";
import { Button } from "./ui";
import { GradePicker } from "./GradePicker";
import { Stars } from "./Stars";

export type LogOutcome = "flash" | "send" | "attempt" | "project";

const OUTCOMES: {
  value: LogOutcome;
  label: string;
  hint: string;
  Icon: typeof Zap;
}[] = [
  { value: "flash", label: "Flash", hint: "First try", Icon: Zap },
  { value: "send", label: "Sent", hint: "Topped it", Icon: Check },
  { value: "project", label: "Project", hint: "Working on it", Icon: Bookmark },
];

const REWARD: Record<LogOutcome, { title: string; sub: string }> = {
  flash: { title: "Flashed!", sub: "First try. Filthy." },
  send: { title: "Sent!", sub: "Another one for the book." },
  attempt: { title: "Logged", sub: "It's going down soon." },
  project: { title: "On the board", sub: "Saved to your projects." },
};

/**
 * THE log sheet — the one way to log a climb everywhere in the app. Captures
 * outcome, felt grade, quality stars, try count, note, and an optional photo.
 * Every log feeds two places at once: the route's shared record (grades,
 * ratings, attempts, gallery) and the user's personal logbook + stats.
 */
export function LogSheet({
  route,
  onClose,
  onSaved,
}: {
  route: RouteWithStats;
  onClose: () => void;
  /** Called after the reward moment with the chosen outcome. */
  onSaved: (outcome: LogOutcome) => void;
}) {
  const { profile } = useAuth();
  const system = profile?.grade_system ?? "american";
  const photoRef = useRef<HTMLInputElement>(null);

  const [outcome, setOutcome] = useState<LogOutcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [gymGrade, setGymGrade] = useState<number | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [tries, setTries] = useState(1);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reward, setReward] = useState<LogOutcome | null>(null);

  // What the crowd already thinks — shown right when it's most useful.
  const crowdGrade = communityGrade(route.gradeValues);
  const intel: string[] = [];
  if (crowdGrade !== null)
    intel.push(
      `Others say ~${formatGradeStyled(crowdGrade, route.climbing_type, system, route.gradingStyle)}`,
    );
  if (route.funAvg !== null && route.funCount > 0)
    intel.push(`★ ${route.funAvg.toFixed(1)}`);
  if (route.avgAttempts !== null)
    intel.push(`avg ${Math.round(route.avgAttempts * 10) / 10} tries`);
  if (route.climbers > 0)
    intel.push(`${route.climbers} climber${route.climbers === 1 ? "" : "s"}`);

  function pickOutcome(o: LogOutcome) {
    setOutcome(o);
    if (o === "flash") setTries(1); // a flash is by definition one try
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

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
    // The gym's official grade — seed it if this route doesn't have one yet.
    if (
      gymGrade !== null &&
      (route.gym_grade === null || route.gym_grade === undefined)
    ) {
      await supabase.rpc("set_gym_grade", {
        p_route_id: route.id,
        p_grade: gymGrade,
      });
    }
    // Quality stars feed the route's shared rating.
    if (stars !== null) {
      await supabase.from("route_ratings").upsert(
        {
          route_id: route.id,
          user_id: profile.id,
          stars,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "route_id,user_id" },
      );
    }

    if (outcome === "project") {
      await toggleBookmark(profile.id, route.id, "project", false);
    } else {
      // Optional photo joins the route's shared gallery.
      let photoUrl: string | null = null;
      if (photo) {
        try {
          const ext = photo.name.split(".").pop() || "jpg";
          const path = `${profile.id}/${Date.now()}-log.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("route-photos")
            .upload(path, photo, { contentType: photo.type });
          if (!upErr) {
            photoUrl = supabase.storage
              .from("route-photos")
              .getPublicUrl(path).data.publicUrl;
          }
        } catch {
          // A failed photo upload shouldn't lose the log itself.
        }
      }
      const trimmed = note.trim();
      await supabase.from("sends").upsert(
        {
          route_id: route.id,
          user_id: profile.id,
          send_type: outcome as SendType,
          attempts: tries,
          note: trimmed.length ? trimmed : null,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        },
        { onConflict: "route_id,user_id" },
      );
    }

    setSaving(false);
    // The reward moment — let it land, then hand back to the caller.
    setReward(outcome);
    setTimeout(() => onSaved(outcome), 1100);
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4 backdrop-blur-[2px]">
      <div className="relative w-full animate-fade-up overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-card">
        {/* Route header */}
        <div className="mb-3 flex items-center gap-3">
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

        {/* Shared intelligence, right when you need it */}
        {intel.length > 0 ? (
          <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            {intel.join(" · ")}
          </p>
        ) : (
          <p className="mb-4 rounded-xl bg-surface-2 px-3 py-2 text-xs text-faint">
            No one's logged this yet — your log sets the tone.
          </p>
        )}

        {/* Outcome */}
        <div className="grid grid-cols-3 gap-2">
          {OUTCOMES.map(({ value, label, hint, Icon }) => {
            const on = outcome === value;
            return (
              <button
                key={value}
                onClick={() => pickOutcome(value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-3 transition ${
                  on
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface-2 text-muted hover:text-chalk"
                }`}
              >
                <Icon size={18} />
                <span className="text-xs font-bold">{label}</span>
                <span className="text-[9px] text-faint">{hint}</span>
              </button>
            );
          })}
        </div>

        {/* Tries + quality — hidden for project saves */}
        {outcome && outcome !== "project" ? (
          <div className="mt-4 flex animate-fade-in items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-faint">
                Tries
              </span>
              <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
                <button
                  onClick={() => setTries((t) => Math.max(1, t - 1))}
                  disabled={outcome === "flash" || tries <= 1}
                  aria-label="Fewer tries"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:text-chalk disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-bold tabular-nums text-chalk">
                  {tries}
                </span>
                <button
                  onClick={() => setTries((t) => Math.min(200, t + 1))}
                  disabled={outcome === "flash"}
                  aria-label="More tries"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:text-chalk disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-faint">
                Quality
              </span>
              <Stars value={stars} onChange={setStars} size={20} />
            </div>
          </div>
        ) : null}

        {/* Your grade */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Your grade
            <span className="ml-1 font-normal normal-case text-faint">
              (what did it feel like?)
            </span>
          </h3>
          <GradePicker
            value={feltGrade}
            onChange={setFeltGrade}
            climbingType={route.climbing_type}
            system={system}
          />
        </div>

        {/* Gym's grade — seeds the route's official grade if it's not set yet */}
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Gym's grade
            <span className="ml-1 font-normal normal-case text-faint">
              (what does the tag say?)
            </span>
          </h3>
          {route.gym_grade !== null && route.gym_grade !== undefined ? (
            <p className="text-sm text-muted">
              Gym says{" "}
              <span className="font-bold text-chalk">
                {formatGradeStyled(
                  route.gym_grade,
                  route.climbing_type,
                  system,
                )}
              </span>
            </p>
          ) : (
            <GradePicker
              value={gymGrade}
              onChange={setGymGrade}
              climbingType={route.climbing_type}
              system={system}
            />
          )}
        </div>

        {/* Note + photo */}
        <div className="mt-4 flex items-start gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional) — how'd it feel?"
            maxLength={280}
            className="min-h-[56px] flex-1 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-base text-chalk placeholder:text-faint outline-none focus:border-accent"
          />
          {outcome !== "project" ? (
            <>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPickPhoto}
                className="hidden"
              />
              <button
                onClick={() => photoRef.current?.click()}
                aria-label="Add a photo"
                className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-2 text-faint transition hover:text-chalk"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera size={20} className="mx-auto" />
                )}
              </button>
            </>
          ) : null}
        </div>

        <Button
          className="mt-4 w-full"
          disabled={!outcome}
          loading={saving}
          onClick={save}
        >
          {outcome === "project" ? "Save to projects" : "Log it"}
        </Button>

        {/* Reward moment */}
        {reward ? (
          <div className="absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center gap-3 bg-surface/95 backdrop-blur-sm">
            <span className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" />
              <span className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-accent text-bg shadow-glow">
                {reward === "flash" ? (
                  <Zap size={30} strokeWidth={2.5} />
                ) : reward === "project" ? (
                  <Bookmark size={28} strokeWidth={2.5} />
                ) : (
                  <Check size={32} strokeWidth={3} />
                )}
              </span>
            </span>
            <p className="animate-fade-up text-2xl font-extrabold text-chalk [animation-delay:120ms]">
              {REWARD[reward].title}
            </p>
            <p className="animate-fade-up text-sm text-muted [animation-delay:200ms]">
              {REWARD[reward].sub}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

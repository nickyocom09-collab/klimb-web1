import { ChevronLeft, Lock, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEntitlements } from "../lib/entitlements";
import {
  LOGBOOK_PRESETS,
  type LogbookPreferences,
  useLogbookPreferences,
} from "../lib/logbookPreferences";
import { CenterSpinner } from "../components/ui";
import { useAuth } from "../lib/auth";

const FIELDS: Array<{ key: keyof LogbookPreferences; label: string; description: string }> = [
  { key: "show_photo", label: "Photo", description: "Add or take a route photo." },
  { key: "show_video", label: "Video", description: "Attach a clip under three minutes to this Klimb." },
  { key: "show_hold_color", label: "Hold color", description: "Record the hold or circuit color." },
  { key: "show_gym_grade", label: "Gym's grade", description: "Record what the route tag says." },
  { key: "show_felt_grade", label: "Felt grade", description: "Add your own grade opinion." },
  { key: "show_quality", label: "Quality rating", description: "Rate the climb from one to five stars." },
  { key: "show_route_name", label: "Route name", description: "Add the setter's route name when available." },
  { key: "show_note", label: "Notes", description: "Save beta or a memory from the climb." },
  { key: "show_profile_visibility", label: "Post to profile", description: "Choose whether each Klimb appears to friends." },
];

export function CustomizeLogbook() {
  const navigate = useNavigate();
  const { hasProAccess } = useEntitlements();
  const { preferences, loading, save } = useLogbookPreferences();
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveSynced(next: LogbookPreferences) {
    if (!hasProAccess || saving) return;
    setSaving(true);
    setSaveError(null);
    const previous = preferences;
    const result = await save(next);
    if (result.error) {
      setSaveError("Couldn't save your logbook settings. Try again.");
      setSaving(false);
      return;
    }
    if (next.show_route_name !== (profile?.route_names_enabled ?? false)) {
      const profileResult = await updateProfile({
        route_names_enabled: next.show_route_name,
      });
      if (profileResult.error) {
        await save(previous);
        setSaveError("Couldn't sync route names. Check your connection and try again.");
      }
    }
    setSaving(false);
  }

  async function toggle(key: keyof LogbookPreferences) {
    if (!hasProAccess) {
      navigate({ search: "?pro=customize" });
      return;
    }
    const current =
      key === "show_route_name"
        ? (profile?.route_names_enabled ?? false)
        : preferences[key];
    await saveSynced({ ...preferences, [key]: !current });
  }

  return (
    <div className="mx-auto min-h-full max-w-app bg-bg pb-12">
      <header className="flex items-center gap-3 px-5 py-5">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-muted">
          <ChevronLeft size={27} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Pro settings</p>
          <h1 className="text-2xl font-extrabold text-chalk">Customize logbook</h1>
        </div>
        <Sparkles size={20} className="text-accent" />
      </header>

      <main className="px-5">
        <p className="text-sm leading-6 text-muted">
          Keep climb type and outcome, then decide which optional questions Klimb asks you.
        </p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {Object.entries(LOGBOOK_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              type="button"
              disabled={saving}
              onClick={() => hasProAccess ? void saveSynced(preset) : navigate({ search: "?pro=customize" })}
              className="shrink-0 rounded-full border border-border bg-surface px-4 py-2 text-xs font-bold text-chalk transition active:scale-95"
            >
              {name} preset
            </button>
          ))}
        </div>

        {loading ? <CenterSpinner /> : (
          <div className="relative mt-5 overflow-hidden rounded-3xl border border-border bg-surface shadow-card">
            <div className="divide-y divide-border/70">
              {FIELDS.map((field) => {
                const enabled =
                  field.key === "show_route_name"
                    ? (profile?.route_names_enabled ?? false)
                    : preferences[field.key];
                return (
                  <button
                    key={field.key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={saving}
                    onClick={() => void toggle(field.key)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-chalk">
                        {field.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-faint">{field.description}</span>
                    </span>
                    <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-accent" : "bg-bg"}`}>
                      <span className={`absolute top-1 h-5 w-5 rounded-full transition-transform ${enabled ? "translate-x-6 bg-bg" : "translate-x-1 bg-muted"}`} />
                    </span>
                  </button>
                );
              })}
            </div>
            {!hasProAccess ? (
              <button type="button" onClick={() => navigate({ search: "?pro=customize" })} className="absolute inset-0 flex flex-col items-center justify-center bg-bg/72 px-8 text-center backdrop-blur-[5px]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-bg"><Lock size={21} /></span>
                <span className="mt-3 font-extrabold text-chalk">Make logging fit you with Pro</span>
                <span className="mt-1 text-xs leading-5 text-muted">Preview every option here, then unlock presets and custom steps.</span>
                <span className="mt-4 rounded-full bg-accent px-5 py-2.5 text-xs font-extrabold text-bg">See Klimb Pro</span>
              </button>
            ) : null}
          </div>
        )}

        {saveError ? (
          <p className="mt-3 text-center text-sm text-red-400">{saveError}</p>
        ) : null}

        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-accent/8 p-4 text-xs leading-5 text-muted">
          <SlidersHorizontal size={17} className="mt-0.5 shrink-0 text-accent" />
          Changes apply the next time you log. Your existing Klimbs never change.
        </div>
      </main>
    </div>
  );
}

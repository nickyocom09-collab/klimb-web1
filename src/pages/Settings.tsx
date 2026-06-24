import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  CLIMB_FILTERS,
  GRADE_SYSTEMS,
  THEMES,
  type ClimbFilter,
  type GradeSystemPref,
  type ThemePref,
} from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { Button, Card, Input } from "../components/ui";

/** A pill-style segmented control. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-2 text-muted hover:text-chalk"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="ml-1 text-sm font-semibold uppercase tracking-wide text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Settings() {
  const { profile, session, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const theme = (profile?.theme ?? "dark") as ThemePref;
  const gradeSystem = (profile?.grade_system ?? "american") as GradeSystemPref;
  const defaultFilter = (profile?.default_climb_filter ?? "all") as ClimbFilter;

  async function saveName() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed === profile?.display_name) return;
    setSavingName(true);
    await updateProfile({ display_name: trimmed });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  return (
    <div>
      <AppHeader title="Settings" />
      <div className="flex flex-col gap-7 p-5">
        <Section title="Appearance">
          <Segmented<ThemePref>
            value={theme}
            options={THEMES}
            onChange={(v) => updateProfile({ theme: v })}
          />
        </Section>

        <Section title="Grade system">
          <Segmented<GradeSystemPref>
            value={gradeSystem}
            options={GRADE_SYSTEMS}
            onChange={(v) => updateProfile({ grade_system: v })}
          />
          <p className="ml-1 text-xs text-faint">
            How grades display across the app (V-scale / YDS vs. Font / French).
          </p>
        </Section>

        <Section title="Default feed filter">
          <Segmented<ClimbFilter>
            value={defaultFilter}
            options={CLIMB_FILTERS}
            onChange={(v) => updateProfile({ default_climb_filter: v })}
          />
          <p className="ml-1 text-xs text-faint">
            Which climbing type the feed shows when you open it.
          </p>
        </Section>

        <Section title="Account">
          <Card className="flex flex-col gap-4 p-4">
            <div>
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
              <Button
                variant="secondary"
                className="mt-3 w-full"
                loading={savingName}
                disabled={
                  name.trim().length < 2 ||
                  name.trim() === profile?.display_name
                }
                onClick={saveName}
              >
                {nameSaved ? "Saved" : "Save name"}
              </Button>
            </div>
            <div>
              <p className="ml-1 text-sm text-muted">Email</p>
              <p className="mt-1 ml-1 text-chalk">{session?.user.email}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate("/gym/select")}
            >
              Switch home gym
            </Button>
          </Card>
          <Button variant="danger" className="w-full" onClick={signOut}>
            Sign out
          </Button>
        </Section>
      </div>
    </div>
  );
}

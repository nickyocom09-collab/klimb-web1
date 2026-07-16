import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, Mail, Shield, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  GRADE_SYSTEMS,
  THEMES,
  type GradeSystemPref,
  type ThemePref,
} from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { Button, Card, Input, Textarea } from "../components/ui";

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

  const [uname, setUname] = useState(profile?.username ?? "");
  const [savingU, setSavingU] = useState(false);
  const [uMsg, setUMsg] = useState<string | null>(null);

  const [bio, setBio] = useState(profile?.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_account");
    if (error) {
      setDeleting(false);
      window.alert(`Couldn't delete your account: ${error.message}`);
      return;
    }
    // Account is gone — sign out and drop back to login.
    await signOut();
  }

  async function saveBio() {
    const trimmed = bio.trim();
    if (trimmed === (profile?.bio ?? "")) return;
    setSavingBio(true);
    await updateProfile({ bio: trimmed || null });
    setSavingBio(false);
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  }

  const theme = (profile?.theme ?? "dark") as ThemePref;
  const sendsPublic = profile?.sends_public ?? true;

  async function saveUsername() {
    const h = uname.trim().replace(/^@/, "").toLowerCase();
    if (h === (profile?.username ?? "")) return;
    if (h.length < 3) {
      setUMsg("Usernames need at least 3 characters.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(h)) {
      setUMsg("Use letters, numbers, and underscores only.");
      return;
    }
    setSavingU(true);
    const { error } = await updateProfile({ username: h });
    setSavingU(false);
    setUMsg(error ? "That username is already taken." : "Saved!");
    if (!error) setUname(h);
  }
  const gradeSystem = (profile?.grade_system ?? "american") as GradeSystemPref;

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

        <Section title="Learn the lingo">
          <button
            onClick={() => navigate("/terms")}
            className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <BookOpen size={18} className="text-accent" /> Climber's
              dictionary
            </span>
            <span className="flex items-center gap-1 text-xs text-faint">
              100 terms <ChevronRight size={15} />
            </span>
          </button>
          <p className="ml-1 text-xs text-faint">
            Crimp? Beta? Sandbagged? Every term you'll hear at the gym,
            explained.
          </p>
        </Section>

        <Section title="Privacy">
          <Segmented<string>
            value={sendsPublic ? "public" : "private"}
            options={[
              { value: "public", label: "Public" },
              { value: "private", label: "Private" },
            ]}
            onChange={(v) => updateProfile({ sends_public: v === "public" })}
          />
          <p className="ml-1 text-xs text-faint">
            When private, your sends and projects are hidden from other
            climbers' view of your profile.
          </p>
        </Section>

        <Section title="Account">
          <Card className="flex flex-col gap-4 p-4">
            <div>
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nick Yocom"
              />
              <p className="ml-1 mt-1.5 text-xs text-faint">
                The name shown on your profile and logs.
              </p>
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
              <Input
                label="Username (@handle)"
                value={uname}
                onChange={(e) => {
                  setUname(e.target.value);
                  setUMsg(null);
                }}
                placeholder="nickyocom"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <p className="ml-1 mt-1.5 text-xs text-faint">
                Your unique handle — how friends find and add you.
              </p>
              <Button
                variant="secondary"
                className="mt-3 w-full"
                loading={savingU}
                disabled={
                  uname.trim().replace(/^@/, "").toLowerCase() ===
                  (profile?.username ?? "")
                }
                onClick={saveUsername}
              >
                Save username
              </Button>
              {uMsg ? (
                <p className="ml-1 mt-2 text-xs text-muted">{uMsg}</p>
              ) : null}
            </div>
            <div>
              <Textarea
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A little about your climbing…"
                maxLength={160}
                rows={3}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="ml-1 text-xs text-faint">{bio.length}/160</span>
              </div>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                loading={savingBio}
                disabled={bio.trim() === (profile?.bio ?? "")}
                onClick={saveBio}
              >
                {bioSaved ? "Saved" : "Save bio"}
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
          <button
            onClick={() => {
              setConfirmText("");
              setDeleteOpen(true);
            }}
            className="mt-1 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-wide transition hover:opacity-80"
          >
            <Trash2 size={15} /> Delete account
          </button>
        </Section>

        <Section title="Ideas & feedback">
          <Card className="p-4">
            <p className="text-sm leading-relaxed text-chalk/90">
              Got an idea for a feature, a gym we should add, or a bug you want
              fixed? I read every message — send it my way.
            </p>
            <a
              href="mailto:realklimb@gmail.com?subject=Klimb%20feedback"
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-bold text-bg transition active:scale-[0.99]"
            >
              <Mail size={16} /> realklimb@gmail.com
            </a>
          </Card>
          <button
            onClick={() => navigate("/privacy")}
            className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <Shield size={18} className="text-accent" /> Privacy policy
            </span>
            <ChevronRight size={18} className="text-faint" />
          </button>
        </Section>
      </div>

      {/* Delete-account confirmation sheet */}
      {deleteOpen ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-chalk">Delete account?</h3>
              <button
                onClick={() => setDeleteOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-faint hover:text-chalk"
              >
                <X size={22} />
              </button>
            </div>
            <p className="text-sm text-muted">
              This permanently deletes your profile, sends, projects, grades,
              notes, and friends. Your logged history can't be recovered.
              Routes you added stay for the community.
            </p>
            <p className="mt-4 mb-2 text-sm text-muted">
              Type <span className="font-bold text-chalk">DELETE</span> to
              confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              autoCorrect="off"
            />
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="danger"
                className="w-full"
                loading={deleting}
                disabled={confirmText.trim().toUpperCase() !== "DELETE"}
                onClick={deleteAccount}
              >
                Permanently delete my account
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

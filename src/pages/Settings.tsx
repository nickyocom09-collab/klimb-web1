import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  AtSign,
  Mail,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  fetchBlockedProfiles,
  unblockUser,
  type BlockedProfile,
} from "../lib/moderation";
import { Avatar } from "../components/Avatar";
import {
  GRADE_SYSTEMS,
  LOG_STYLES,
  THEMES,
  type GradeSystemPref,
  type LogStylePref,
  type ThemePref,
} from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { Button, Card, ConfirmDialog, Input, Textarea } from "../components/ui";
import type { Database } from "../lib/database.types";
import { profileNameError } from "../lib/nameModeration";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

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

  const [uname, setUname] = useState(profile?.username ?? "");
  const [uMsg, setUMsg] = useState<string | null>(null);

  const [bio, setBio] = useState(profile?.bio ?? "");

  const [blockedList, setBlockedList] = useState<BlockedProfile[]>([]);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetchBlockedProfiles(profile.id).then(setBlockedList);
  }, [profile]);

  async function onUnblock(otherId: string) {
    if (!profile) return;
    setUnblocking(otherId);
    await unblockUser(profile.id, otherId);
    setUnblocking(null);
    setBlockedList((list) => list.filter((b) => b.id !== otherId));
  }

  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function changeEmail() {
    const next = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      setEmailMsg("Enter a valid email address.");
      return;
    }
    setEmailBusy(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: next });
    setEmailBusy(false);
    if (error) {
      setEmailMsg(error.message);
      return;
    }
    setEmailMsg(
      "Check your new inbox — tap the confirmation link to finish the change.",
    );
    setEmailOpen(false);
    setNewEmail("");
  }
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

  const theme = (profile?.theme ?? "dark") as ThemePref;
  const sendsPublic = profile?.sends_public ?? true;
  const projectsPublic = profile?.projects_public ?? true;

  const gradeSystem = (profile?.grade_system ?? "american") as GradeSystemPref;
  const logStyle = (profile?.log_style ?? "steps") as LogStylePref;
  const routeNamesEnabled = profile?.route_names_enabled ?? false;

  async function setRouteNamesEnabled(next: boolean) {
    const { error } = await updateProfile({ route_names_enabled: next });
    if (error) window.alert("Couldn't save that setting. Please try again.");
  }

  // --- One "Save changes" for the whole account card -----------------------
  // Three separate save buttons made the page feel like a form graveyard.
  // This writes only what actually changed, in a single pass.
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const normUname = uname.trim().replace(/^@/, "").toLowerCase();
  const accountDirty =
    (trimmedName !== (profile?.display_name ?? "") && trimmedName.length >= 2) ||
    trimmedBio !== (profile?.bio ?? "") ||
    normUname !== (profile?.username ?? "");

  async function saveAccount() {
    if (!accountDirty) return;
    setUMsg(null);
    const moderationError = profileNameError(trimmedName, normUname);
    if (moderationError) {
      setUMsg(moderationError);
      return;
    }
    // Username is the only field with rules — validate before touching anything.
    if (normUname !== (profile?.username ?? "")) {
      if (normUname.length < 3) {
        setUMsg("Usernames need at least 3 characters.");
        return;
      }
      if (!/^[a-z0-9_]+$/.test(normUname)) {
        setUMsg("Use letters, numbers, and underscores only.");
        return;
      }
    }
    const patch: ProfileUpdate = {};
    if (trimmedName !== (profile?.display_name ?? "") && trimmedName.length >= 2)
      patch.display_name = trimmedName;
    if (trimmedBio !== (profile?.bio ?? "")) patch.bio = trimmedBio || null;
    if (normUname !== (profile?.username ?? "")) patch.username = normUname;

    setSavingAccount(true);
    const { error } = await updateProfile(patch);
    setSavingAccount(false);
    if (error) {
      setUMsg(
        patch.username
          ? "That username is already taken."
          : "Couldn't save — try again.",
      );
      return;
    }
    if (patch.username) setUname(normUname);
    setAccountSaved(true);
    setTimeout(() => setAccountSaved(false), 2000);
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

        <Section title="Log style">
          <Segmented<LogStylePref>
            value={logStyle}
            options={LOG_STYLES}
            onChange={(v) => updateProfile({ log_style: v })}
          />
          <p className="ml-1 text-xs text-faint">
            Log a Klimb on one scrollable screen, or step through it one
            question at a time.
          </p>
        </Section>

        <Section title="Route names">
          <button
            type="button"
            role="switch"
            aria-checked={routeNamesEnabled}
            onClick={() => void setRouteNamesEnabled(!routeNamesEnabled)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-semibold text-chalk">
                Add route names
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-faint">
                Show an optional name field when you log a Klimb. Named routes
                replace the hold color in your logbook.
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                routeNamesEnabled ? "bg-accent" : "bg-surface-2 ring-1 ring-border"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  routeNamesEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
          <p className="ml-1 text-xs text-faint">
            Turning this off hides the field; names you already saved stay on
            their routes and can still be edited.
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
          <div className="flex flex-col gap-1.5">
            <p className="ml-1 text-sm font-semibold text-chalk">Sends &amp; logbook</p>
            <Segmented<string>
              value={sendsPublic ? "public" : "private"}
              options={[
                { value: "public", label: "Public" },
                { value: "private", label: "Private" },
              ]}
              onChange={(v) => updateProfile({ sends_public: v === "public" })}
            />
            <p className="ml-1 text-xs text-faint">
              When private, your sends and logbook are hidden from other
              climbers' view of your profile.
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <p className="ml-1 text-sm font-semibold text-chalk">Projects</p>
            <Segmented<string>
              value={projectsPublic ? "public" : "private"}
              options={[
                { value: "public", label: "Public" },
                { value: "private", label: "Private" },
              ]}
              onChange={(v) => updateProfile({ projects_public: v === "public" })}
            />
            <p className="ml-1 text-xs text-faint">
              Controls whether the routes you're projecting show on your
              profile — separate from your sends.
            </p>
          </div>
        </Section>

        <Section title="Account">
          {/* One card, one save. Every field edits in place; the button at the
              bottom writes whatever actually changed. */}
          <Card className="flex flex-col gap-4 p-4">
            <Input
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
            />
            <div>
              <Input
                label="Username"
                value={uname}
                onChange={(e) => {
                  setUname(e.target.value);
                  setUMsg(null);
                }}
                placeholder="supperdopeclimber"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <p className="ml-1 mt-1.5 text-xs text-faint">
                Your @handle — how friends find and add you.
              </p>
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
              <span className="ml-1 mt-1 block text-xs text-faint">
                {bio.length}/160
              </span>
            </div>

            {uMsg ? <p className="ml-1 text-xs text-wide">{uMsg}</p> : null}

            <Button
              className="w-full"
              loading={savingAccount}
              disabled={!accountDirty}
              onClick={saveAccount}
            >
              {accountSaved ? "Saved" : "Save changes"}
            </Button>
          </Card>

          {/* Read-only / navigational rows, kept out of the editable card. */}
          <div className="mt-3 flex flex-col gap-2">
            <div className="rounded-2xl bg-surface px-4 py-3.5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Email</span>
                <div className="flex min-w-0 items-center gap-3 pl-3">
                  <span className="truncate text-sm text-chalk">
                    {session?.user.email}
                  </span>
                  <button
                    onClick={() => {
                      setEmailOpen((v) => !v);
                      setEmailMsg(null);
                      setNewEmail("");
                    }}
                    className="shrink-0 text-sm font-semibold text-accent"
                  >
                    {emailOpen ? "Cancel" : "Change"}
                  </button>
                </div>
              </div>
              {emailOpen ? (
                <div className="mt-3 flex flex-col gap-2">
                  <Input
                    label="New email"
                    type="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <Button
                    className="w-full"
                    loading={emailBusy}
                    onClick={changeEmail}
                  >
                    Update email
                  </Button>
                </div>
              ) : null}
              {emailMsg ? (
                <p className="ml-1 mt-2 text-xs text-accent">{emailMsg}</p>
              ) : null}
            </div>
            <button
              onClick={() => navigate("/gym/select")}
              className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3.5 text-left shadow-card transition active:scale-[0.99]"
            >
              <span className="text-sm font-semibold text-chalk">
                Switch home gym
              </span>
              <ChevronRight size={16} className="text-faint" />
            </button>
          </div>
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
            <a
              href="https://instagram.com/theklimbapp"
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 py-3 text-sm font-bold text-chalk transition active:scale-[0.99]"
            >
              <AtSign size={16} className="text-accent" /> @theklimbapp
            </a>
            <p className="mt-2 text-center text-xs text-faint">
              DM me on Instagram — I'll respond!
            </p>
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

        {blockedList.length > 0 ? (
          <Section title="Blocked climbers">
            <ul className="flex flex-col gap-2">
              {blockedList.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card"
                >
                  <Avatar name={b.display_name} url={b.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-chalk">
                      {b.display_name}
                    </p>
                    {b.username ? (
                      <p className="truncate text-sm text-muted">@{b.username}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0 px-4"
                    loading={unblocking === b.id}
                    onClick={() => onUnblock(b.id)}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Account actions">
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setLogoutOpen(true)}
          >
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
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out?"
        message="You'll need to sign back in to see your logbook, stats, and friends."
        confirmLabel="Sign out"
        variant="danger"
        onConfirm={signOut}
        onCancel={() => setLogoutOpen(false)}
      />

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
              Routes you added stay visible to other climbers at your gym.
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

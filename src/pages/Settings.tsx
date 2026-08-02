import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  AtSign,
  Bell,
  BellOff,
  Flame,
  Gauge,
  Home,
  Mail,
  MoonStar,
  Mountain,
  Palette,
  Route,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
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
import { containsProfanity, profileNameError } from "../lib/nameModeration";
import {
  usePushNotifications,
  type NotificationPreferenceKey,
} from "../lib/pushNotifications";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

/** A compact, high-contrast segmented control shared by every preference. */
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
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-border/80 bg-bg/45 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`relative min-w-0 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? "border-control/50 bg-control/15 text-chalk shadow-[0_6px_18px_-12px_rgb(var(--c-control)/0.9)]"
                : "border-transparent text-muted hover:bg-surface-2/70 hover:text-chalk"
            }`}
          >
            {active ? (
              <span className="absolute inset-x-3 bottom-0 h-px rounded-full bg-control/80" />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 px-1">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-control/20 bg-control/10 text-control">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-chalk/90">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-faint">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-all duration-200 ${
        enabled
          ? "border-control/70 bg-control shadow-[0_0_0_3px_rgb(var(--c-control)/0.1)]"
          : "border-border bg-bg/55"
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full transition-all duration-200 ${
          enabled
            ? "translate-x-[23px] bg-bg shadow-[0_2px_8px_rgb(0_0_0/0.4)]"
            : "translate-x-[3px] bg-muted shadow-sm"
        }`}
      />
    </span>
  );
}

function NotificationToggle({
  label,
  description,
  icon,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="group flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors active:bg-control/[0.06]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            enabled
              ? "border-control/25 bg-control/10 text-control"
              : "border-border bg-bg/35 text-faint"
          }`}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-chalk">
            {label}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-faint">
            {description}
          </span>
        </span>
      </span>
      <ToggleSwitch enabled={enabled} />
    </button>
  );
}

export function Settings() {
  const { profile, session, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const push = usePushNotifications();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
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
    // Storage intentionally blocks direct SQL deletion. Remove avatar objects
    // through its API while the user still has permission, then delete the
    // database/auth account. A failed cleanup must not trap the account.
    if (profile?.id) {
      const { data: avatarFiles } = await supabase.storage
        .from("avatars")
        .list(profile.id);
      if (avatarFiles?.length) {
        await supabase.storage
          .from("avatars")
          .remove(avatarFiles.map((file) => `${profile.id}/${file.name}`));
      }
    }
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

  async function togglePushMaster() {
    setPushBusy(true);
    setPushMessage(null);
    const result = push.active ? await push.disable() : await push.enable();
    setPushBusy(false);
    setPushMessage(
      result.error ??
        (push.active
          ? "Notifications are off on this device."
          : "Notifications are enabled. You can choose what Klimb sends below."),
    );
  }

  async function setPushPreference(
    key: NotificationPreferenceKey,
    value: boolean,
  ) {
    const result = await push.updatePreference(key, value);
    if (result.error) setPushMessage(result.error);
  }

  // --- One "Save changes" for the whole account card -----------------------
  // Three separate save buttons made the page feel like a form graveyard.
  // This writes only what actually changed, in a single pass.
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const normUname = uname.trim().replace(/^@/, "").toLowerCase();
  const accountDirty =
    (trimmedName !== (profile?.display_name ?? "") &&
      trimmedName.length >= 2) ||
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
    if (containsProfanity(trimmedBio)) {
      setUMsg("Please edit your bio to remove profanity.");
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
    if (
      trimmedName !== (profile?.display_name ?? "") &&
      trimmedName.length >= 2
    )
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
    <div className="settings-page min-h-full">
      <AppHeader title="Settings" />
      <div className="flex flex-col gap-7 px-4 pb-12 pt-4">
        <div className="relative overflow-hidden rounded-[28px] border border-control/20 bg-surface px-5 py-5 shadow-card">
          <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-control/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-control/25 bg-control/10 text-control">
              <Settings2 size={21} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-base font-bold tracking-[-0.015em] text-chalk">
                Make Klimb yours.
              </p>
              <p className="mt-1 max-w-[300px] text-sm leading-relaxed text-muted">
                Tune how you log, what you share, and when Klimb checks in.
              </p>
            </div>
          </div>
        </div>

        <Section
          title="Climbing preferences"
          description="The defaults Klimb uses throughout your logbook."
          icon={<Palette size={18} />}
        >
          <Card className="overflow-hidden border border-border/80 p-0">
            <div className="border-b border-border/80 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <MoonStar size={17} className="text-control" />
                <div>
                  <p className="text-sm font-semibold text-chalk">Appearance</p>
                  <p className="text-xs text-faint">Choose your app theme.</p>
                </div>
              </div>
              <Segmented<ThemePref>
                value={theme}
                options={THEMES}
                onChange={(v) => updateProfile({ theme: v })}
              />
            </div>

            <div className="border-b border-border/80 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Gauge size={17} className="text-control" />
                <div>
                  <p className="text-sm font-semibold text-chalk">
                    Grade system
                  </p>
                  <p className="text-xs text-faint">
                    V-scale / YDS or Font / French.
                  </p>
                </div>
              </div>
              <Segmented<GradeSystemPref>
                value={gradeSystem}
                options={GRADE_SYSTEMS}
                onChange={(v) => updateProfile({ grade_system: v })}
              />
            </div>

            <div className="border-b border-border/80 p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <Route size={17} className="text-control" />
                <div>
                  <p className="text-sm font-semibold text-chalk">Log style</p>
                  <p className="text-xs text-faint">
                    One smooth scroll or guided questions.
                  </p>
                </div>
              </div>
              <Segmented<LogStylePref>
                value={logStyle}
                options={LOG_STYLES}
                onChange={(v) => updateProfile({ log_style: v })}
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={routeNamesEnabled}
              onClick={() => void setRouteNamesEnabled(!routeNamesEnabled)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors active:bg-control/[0.06]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-control/20 bg-control/10 text-control">
                  <Sparkles size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-chalk">
                    Add route names
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                    Show an optional name when logging. Existing names stay
                    saved if you turn this off.
                  </span>
                </span>
              </span>
              <ToggleSwitch enabled={routeNamesEnabled} />
            </button>
          </Card>
        </Section>

        <Section
          title="Notifications"
          description="Only the updates you actually want."
          icon={<Bell size={18} />}
        >
          <Card className="overflow-hidden border border-border/80 p-0">
            <div className="relative flex items-center gap-3 border-b border-border/80 px-4 py-4">
              {push.active ? (
                <span className="absolute inset-y-0 left-0 w-[2px] bg-control" />
              ) : null}
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                  push.active
                    ? "border-control/25 bg-control/10 text-control"
                    : "border-border bg-bg/40 text-faint"
                }`}
              >
                {push.active ? <Bell size={20} /> : <BellOff size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-chalk">
                  {push.active
                    ? "Apple notifications are on"
                    : "Apple notifications are off"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-faint">
                  {push.active
                    ? "Choose exactly what can reach you."
                    : "Recaps, streak reminders, and friend activity."}
                </p>
              </div>
              <button
                type="button"
                className={`h-10 shrink-0 rounded-xl border px-4 text-sm font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
                  push.active
                    ? "border-border bg-bg/45 text-muted"
                    : "border-control/50 bg-control text-bg shadow-[0_8px_20px_-12px_rgb(var(--c-control)/0.9)]"
                }`}
                disabled={!push.available}
                onClick={() => void togglePushMaster()}
              >
                {pushBusy ? "Saving…" : push.active ? "Turn off" : "Enable"}
              </button>
            </div>

            {push.active && push.preferences ? (
              <div className="divide-y divide-border">
                <NotificationToggle
                  label="Friend requests"
                  description="When another climber wants to connect."
                  icon={<UserPlus size={17} />}
                  enabled={push.preferences.friend_requests}
                  onChange={(value) =>
                    void setPushPreference("friend_requests", value)
                  }
                />
                <NotificationToggle
                  label="New friends"
                  description="When someone accepts your request."
                  icon={<UserCheck size={17} />}
                  enabled={push.preferences.friend_accepts}
                  onChange={(value) =>
                    void setPushPreference("friend_accepts", value)
                  }
                />
                <NotificationToggle
                  label="Weekly recap"
                  description="When your Sunday recap is ready to watch."
                  icon={<BarChart3 size={17} />}
                  enabled={push.preferences.weekly_recaps}
                  onChange={(value) =>
                    void setPushPreference("weekly_recaps", value)
                  }
                />
                <NotificationToggle
                  label="Streak reminders"
                  description="Sunday afternoon when your weekly streak is at risk."
                  icon={<Flame size={17} />}
                  enabled={push.preferences.streak_risk}
                  onChange={(value) =>
                    void setPushPreference("streak_risk", value)
                  }
                />
                <NotificationToggle
                  label="Come climb"
                  description="A friendly reminder after 14 days away."
                  icon={<Mountain size={17} />}
                  enabled={push.preferences.inactivity}
                  onChange={(value) =>
                    void setPushPreference("inactivity", value)
                  }
                />
              </div>
            ) : null}
          </Card>
          {!push.available ? (
            <p className="ml-1 text-xs text-faint">
              Notification controls are available in the Klimb iPhone app.
            </p>
          ) : null}
          {push.permission === "denied" ? (
            <p className="ml-1 text-xs text-wide">
              Permission was denied. Open iPhone Settings → Notifications →
              Klimb to turn it back on.
            </p>
          ) : null}
          {pushMessage || push.error ? (
            <p className="ml-1 text-xs text-faint">
              {pushMessage ?? push.error}
            </p>
          ) : null}
        </Section>

        <Section
          title="Explore"
          description="Helpful shortcuts beyond your daily logbook."
          icon={<BookOpen size={18} />}
        >
          <button
            onClick={() => navigate("/terms")}
            className="flex w-full items-center justify-between rounded-2xl border border-border/80 bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-3 text-sm font-semibold text-chalk">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-control/10 text-control">
                <BookOpen size={17} />
              </span>
              Climber's dictionary
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium text-faint">
              100 terms <ChevronRight size={15} />
            </span>
          </button>
        </Section>

        <Section
          title="Privacy"
          description="Decide what other climbers can see."
          icon={<Shield size={18} />}
        >
          <Card className="overflow-hidden border border-border/80 p-0">
            <div className="border-b border-border/80 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-chalk">
                  Sends &amp; logbook
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-faint">
                  Hide your sends and full logbook from other climbers.
                </p>
              </div>
              <Segmented<string>
                value={sendsPublic ? "public" : "private"}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
                onChange={(v) =>
                  updateProfile({ sends_public: v === "public" })
                }
              />
            </div>
            <div className="p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-chalk">Projects</p>
                <p className="mt-0.5 text-xs leading-relaxed text-faint">
                  Control projected routes separately from your sends.
                </p>
              </div>
              <Segmented<string>
                value={projectsPublic ? "public" : "private"}
                options={[
                  { value: "public", label: "Public" },
                  { value: "private", label: "Private" },
                ]}
                onChange={(v) =>
                  updateProfile({ projects_public: v === "public" })
                }
              />
            </div>
          </Card>
        </Section>

        <Section
          title="Profile & account"
          description="The details friends use to recognize you."
          icon={<AtSign size={18} />}
        >
          {/* One card, one save. Every field edits in place; the button at the
              bottom writes whatever actually changed. */}
          <Card className="flex flex-col gap-4 border border-border/80 p-4">
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
          <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-card">
            <div className="border-b border-border/80 px-4 py-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-chalk">Email</span>
                <div className="flex min-w-0 items-center gap-3 pl-3">
                  <span className="truncate text-xs text-muted">
                    {session?.user.email}
                  </span>
                  <button
                    onClick={() => {
                      setEmailOpen((v) => !v);
                      setEmailMsg(null);
                      setNewEmail("");
                    }}
                    className="shrink-0 text-sm font-semibold text-control"
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
                <p className="ml-1 mt-2 text-xs text-control">{emailMsg}</p>
              ) : null}
            </div>
            <button
              onClick={() => navigate("/gym/select")}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors active:bg-control/[0.06]"
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-chalk">
                <Home size={17} className="text-control" /> Switch home gym
              </span>
              <ChevronRight size={16} className="text-faint" />
            </button>
          </div>
        </Section>

        <Section
          title="Help & feedback"
          description="Questions, ideas, and ways to reach Klimb."
          icon={<Mail size={18} />}
        >
          <Card className="border border-border/80 p-4">
            <p className="text-sm leading-relaxed text-chalk/90">
              Got an idea for a feature, a gym we should add, or a bug you want
              fixed? I read every message — send it my way.
            </p>
            <a
              href="mailto:realklimb@gmail.com?subject=Klimb%20feedback"
              className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-control/40 bg-control py-3 text-sm font-bold text-bg shadow-[0_8px_24px_-14px_rgb(var(--c-control)/0.9)] transition active:scale-[0.99]"
            >
              <Mail size={16} /> realklimb@gmail.com
            </a>
            <a
              href="https://instagram.com/theklimbapp"
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 py-3 text-sm font-bold text-chalk transition active:scale-[0.99]"
            >
              <AtSign size={16} className="text-control" /> @theklimbapp
            </a>
            <p className="mt-2 text-center text-xs text-faint">
              DM me on Instagram — I'll respond!
            </p>
          </Card>
          <button
            onClick={() => navigate("/privacy")}
            className="flex w-full items-center justify-between rounded-2xl border border-border/80 bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
              <Shield size={18} className="text-control" /> Privacy policy
            </span>
            <ChevronRight size={18} className="text-faint" />
          </button>
        </Section>

        {blockedList.length > 0 ? (
          <Section
            title="Blocked climbers"
            description="People you have hidden from your Klimb experience."
            icon={<Shield size={18} />}
          >
            <ul className="flex flex-col gap-2">
              {blockedList.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-surface p-3 shadow-card"
                >
                  <Avatar name={b.display_name} url={b.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-chalk">
                      {b.display_name}
                    </p>
                    {b.username ? (
                      <p className="truncate text-sm text-muted">
                        @{b.username}
                      </p>
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

        <Section
          title="Account actions"
          description="Sign out or permanently remove your account."
          icon={<Trash2 size={18} />}
        >
          <Card className="overflow-hidden border border-border/80 p-0">
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center justify-between border-b border-border/80 px-4 py-4 text-left transition-colors active:bg-surface-2"
            >
              <span className="text-sm font-semibold text-chalk">Sign out</span>
              <ChevronRight size={16} className="text-faint" />
            </button>
            <button
              onClick={() => {
                setConfirmText("");
                setDeleteOpen(true);
              }}
              className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors active:bg-wide/[0.06]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-wide">
                <Trash2 size={15} /> Delete account
              </span>
              <ChevronRight size={16} className="text-wide/55" />
            </button>
          </Card>
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
              notes, and friends. Your logged history can't be recovered. Routes
              you added stay visible to other climbers at your gym.
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

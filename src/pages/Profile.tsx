import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronRight,
  Crown,
  Settings as SettingsIcon,
  Stamp,
  Trophy,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { Avatar } from "../components/Avatar";
import { AvatarCropper } from "../components/AvatarCropper";
import { Button, ConfirmDialog } from "../components/ui";
import {
  AVATAR_SOURCE_MAX_BYTES,
  IMAGE_ACCEPT,
  imageContentError,
  imageUploadError,
} from "../lib/uploadSecurity";
import { secureImageUpload } from "../lib/secureImageUpload";
import { useEntitlements } from "../lib/entitlements";
import { ProBadge } from "../components/ProBadge";
import { ProfileBadge } from "../components/ProfileBadge";
import {
  fetchProfileBadges,
  type ProfileBadge as ProfileBadgeRecord,
} from "../lib/profileBadges";

// Profile is intentionally simple: who you are, your headline numbers, and a
// couple of doors (friends, logbook, settings). The logbook itself lives on
// the Sends tab.
export function Profile() {
  const { profile, updateProfile, signOut } = useAuth();
  const { hasProAccess } = useEntitlements();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [gymName, setGymName] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number | null>(null);
  const [flashCount, setFlashCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarToCrop, setAvatarToCrop] = useState<File | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [specialBadge, setSpecialBadge] = useState<ProfileBadgeRecord | null>(null);

  useEffect(() => {
    if (!profile) {
      setSpecialBadge(null);
      return;
    }
    let active = true;
    void fetchProfileBadges([profile.id]).then((badges) => {
      if (active) setSpecialBadge(badges.get(profile.id) ?? null);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      if (profile.home_gym_id) {
        const { data } = await supabase
          .from("gyms")
          .select("name")
          .eq("id", profile.home_gym_id)
          .maybeSingle();
        if (active) setGymName(data?.name ?? null);
      }
      // Off-grid climbs count toward the user's own totals too — pull the
      // waiting ones and fold them into each headline number.
      const { data: offGrid } = await supabase
        .from("personal_logs")
        .select("outcome")
        .eq("user_id", profile.id)
        .is("transferred_at", null);
      const og = offGrid ?? [];
      const ogSends = og.filter((o) => o.outcome !== "project").length;
      const ogFlashes = og.filter((o) => o.outcome === "flash").length;
      const ogProjects = og.filter((o) => o.outcome === "project").length;

      const sends = await supabase
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .neq("send_type", "attempt");
      if (active) setSendCount((sends.count ?? 0) + ogSends);
      const flashes = await supabase
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("send_type", "flash");
      if (active) setFlashCount((flashes.count ?? 0) + ogFlashes);
      const projects = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("kind", "project");
      if (active) setProjectCount((projects.count ?? 0) + ogProjects);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const validationError = imageUploadError(f, AVATAR_SOURCE_MAX_BYTES);
    if (validationError) {
      window.alert(validationError);
      return;
    }
    setAvatarToCrop(f);
  }

  async function uploadAvatar(f: File) {
    if (!f || !profile) return;
    setUploading(true);
    try {
      const validationError = imageUploadError(f, 5 * 1024 * 1024);
      if (validationError) throw new Error(validationError);
      const contentError = await imageContentError(f);
      if (contentError) throw new Error(contentError);
      const upload = await secureImageUpload(f, "avatar");
      await updateProfile({ avatar_url: upload.publicUrl });
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Could not upload photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <AppHeader
        title="Profile"
        right={
          <button
            onClick={() => navigate("/settings")}
            aria-label="Settings"
            className="rounded-full p-2 text-muted transition hover:text-chalk"
          >
            <SettingsIcon size={22} />
          </button>
        }
      />

      <div className="flex flex-col items-center px-5 py-4">
        {avatarToCrop ? <AvatarCropper file={avatarToCrop} onCancel={() => setAvatarToCrop(null)} onConfirm={(file) => { setAvatarToCrop(null); void uploadAvatar(file); }} /> : null}
        <input
          ref={avatarRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={onPickAvatar}
          className="hidden"
        />
        <button
          onClick={() => avatarRef.current?.click()}
          className="relative mb-3 rounded-full"
          aria-label="Change photo"
        >
          <Avatar
            name={profile?.display_name}
            url={profile?.avatar_url}
            size={88}
          />
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-bg ring-4 ring-bg">
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Camera size={16} />
            )}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-extrabold text-chalk">
            {profile?.display_name ?? "Climber"}
          </h2>
          {hasProAccess ? <ProBadge /> : null}
        </div>
        {profile?.username ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
            <p className="text-sm text-muted">@{profile.username}</p>
            {specialBadge ? <ProfileBadge badge={specialBadge} /> : null}
          </div>
        ) : (
          <button
            onClick={() => navigate("/settings")}
            className="mt-0.5 text-sm text-accent"
          >
            Set a username
          </button>
        )}
        {profile?.bio ? (
          <p className="mt-2 max-w-xs whitespace-pre-line text-center text-sm text-chalk/90">
            {profile.bio}
          </p>
        ) : null}
        {gymName ? (
          <button
            onClick={() => navigate("/gyms")}
            className="mt-1 text-sm text-faint"
          >
            {gymName}
          </button>
        ) : null}

        {!hasProAccess ? (
          <button
            type="button"
            onClick={() => navigate("/upgrade")}
            className="mt-4 flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-2.5 text-sm font-extrabold text-accent transition active:scale-[0.98]"
          >
            <Crown size={16} /> Get Klimb Pro
          </button>
        ) : null}

        <Button
          variant="secondary"
          className="mt-4 px-6"
          onClick={() => navigate("/friends")}
        >
          Friends
        </Button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-2 px-5">
        <Stat label="Sends" value={sendCount} />
        <Stat label="Flashes" value={flashCount} />
        <Stat label="Projects" value={projectCount} />
      </div>

      {/* Door to the logbook — the routes themselves live on the Sends tab. */}
      <div className="px-5 pt-4">
        <button
          onClick={() => navigate("/logbook")}
          className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
            <Trophy size={18} className="text-accent" /> Full logbook
          </span>
          <ChevronRight size={18} className="text-faint" />
        </button>
        <button
          onClick={() => navigate("/passport")}
          className="mt-2 flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-card transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-chalk">
            <Stamp size={18} style={{ color: "#ffc24b" }} /> My passport
          </span>
          <ChevronRight size={18} className="text-faint" />
        </button>
      </div>

      <div className="p-5">
        <Button
          variant="danger"
          className="w-full"
          onClick={() => setConfirmLogout(true)}
        >
          Sign out
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You'll need to sign back in to see your logbook, stats, and friends."
        confirmLabel="Sign out"
        variant="danger"
        onConfirm={signOut}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-surface py-4 text-center shadow-card">
      <div className="flex h-7 items-center justify-center text-2xl font-extrabold text-accent">
        {value === null ? "—" : <RollingNumber value={value} />}
      </div>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

/** Personal-profile-only odometer. Every digit rolls twice, then settles on
 * the fetched total. Public profiles deliberately use completely static text. */
function RollingNumber({ value }: { value: number }) {
  const digits = String(Math.max(0, value)).split("");
  return (
    <span key={value} className="inline-flex tabular-nums" aria-label={String(value)}>
      <style>{`
        @keyframes klimb-personal-stat-roll {
          from { transform: translateY(0); filter: blur(1.5px); }
          to { transform: translateY(calc(var(--roll-stop) * -1em)); filter: blur(0); }
        }
        .klimb-personal-stat-track {
          animation: klimb-personal-stat-roll .82s cubic-bezier(.18,.78,.22,1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .klimb-personal-stat-track { animation-duration: 0.01ms; }
        }
      `}</style>
      {digits.map((digit, index) => {
        const stop = 20 + Number(digit);
        return (
          <span key={`${index}:${digit}`} className="h-[1em] w-[0.62em] overflow-hidden leading-[1em]" aria-hidden="true">
            <span
              className="klimb-personal-stat-track flex flex-col"
              style={{
                "--roll-stop": stop,
                animationDelay: `${index * 45}ms`,
              } as React.CSSProperties}
            >
              {Array.from({ length: 30 }, (_, number) => (
                <span key={number} className="h-[1em] shrink-0 leading-[1em]">
                  {number % 10}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

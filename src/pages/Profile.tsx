import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronRight,
  Settings as SettingsIcon,
  Stamp,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AppHeader } from "../components/Layout";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/ui";

// Profile is intentionally simple: who you are, your headline numbers, and a
// couple of doors (friends, logbook, settings). The logbook itself lives on
// the Sends tab.
export function Profile() {
  const { profile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [gymName, setGymName] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number | null>(null);
  const [flashCount, setFlashCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

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
      const sends = await supabase
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .neq("send_type", "attempt");
      if (active) setSendCount(sends.count ?? 0);
      const flashes = await supabase
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("send_type", "flash");
      if (active) setFlashCount(flashes.count ?? 0);
      const projects = await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("kind", "project");
      if (active) setProjectCount(projects.count ?? 0);
      const friends = await supabase
        .from("friendships")
        .select("id", { count: "exact", head: true })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq("status", "accepted");
      if (active) setFriendCount(friends.count ?? 0);
    })();
    return () => {
      active = false;
    };
  }, [profile]);

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !profile) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop() || "jpg";
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, f, { contentType: f.type, upsert: true });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data
        .publicUrl;
      await updateProfile({ avatar_url: url });
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
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
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
        <h2 className="text-2xl font-extrabold text-chalk">
          {profile?.display_name ?? "Climber"}
        </h2>
        {profile?.username ? (
          <p className="mt-0.5 text-sm text-muted">@{profile.username}</p>
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

        <Button
          variant="secondary"
          className="mt-4 px-6"
          onClick={() => navigate("/friends")}
        >
          <UserPlus size={16} className="mr-1.5" /> Friends
          {friendCount ? ` · ${friendCount}` : ""}
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
        <Button variant="danger" className="w-full" onClick={signOut}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-surface py-4 text-center shadow-card">
      <p className="text-2xl font-extrabold text-accent">{value ?? "—"}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Film, ImagePlus, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  ACCEPTED_VIDEO_TYPES,
  CLIMB_TYPES,
  HOLD_COLORS,
  MAX_ROUTES_PER_DAY,
  MAX_VIDEO_BYTES,
  WALL_SECTIONS,
  type ClimbType,
} from "../lib/constants";
import { AppHeader } from "../components/Layout";
import { Button, ErrorText, Input, Textarea } from "../components/ui";
import { GradePicker } from "../components/GradePicker";

export function AddRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [gymName, setGymName] = useState<string | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [climbingType, setClimbingType] = useState<ClimbType>("boulder");
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const [customSection, setCustomSection] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const system = profile?.grade_system ?? "american";

  useEffect(() => {
    if (!profile?.home_gym_id) return;
    supabase
      .from("gyms")
      .select("name")
      .eq("id", profile.home_gym_id)
      .maybeSingle()
      .then(({ data }) => setGymName(data?.name ?? null));
  }, [profile?.home_gym_id]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_VIDEO_TYPES.includes(f.type)) {
      setError("Video must be an MP4 or MOV file.");
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      setError("Video must be 50 MB or smaller.");
      return;
    }
    setError(null);
    setVideo(f);
    setVideoPreview(URL.createObjectURL(f));
  }

  function clearVideo() {
    setVideo(null);
    setVideoPreview(null);
    if (videoRef.current) videoRef.current.value = "";
  }

  // Changing climbing type changes what a grade ordinal means — reset it.
  function changeType(t: ClimbType) {
    setClimbingType(t);
    setGrade(null);
  }

  const resolvedSection =
    section === "__custom" ? customSection.trim() : section;

  function validate(): string | null {
    if (!photo) return "Add a photo of the route.";
    if (!holdColor) return "Pick the hold color.";
    if (!resolvedSection) return "Choose or enter a wall section.";
    if (!profile?.home_gym_id) return "No home gym selected.";
    return null;
  }

  // Step 1: validate, then ask the user to confirm the gym.
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setConfirming(true);
  }

  async function uploadFile(file: File, suffix: string): Promise<string> {
    const ext = file.name.split(".").pop() || suffix;
    const path = `${profile!.id}/${Date.now()}-${suffix}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("route-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    return supabase.storage.from("route-photos").getPublicUrl(path).data
      .publicUrl;
  }

  // Step 2: gym confirmed — do the actual creation.
  async function create() {
    if (!profile?.home_gym_id || !photo) return;
    setConfirming(false);
    setBusy(true);
    try {
      // Client-side rate-limit pre-check (DB also enforces this).
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("routes")
        .select("id", { count: "exact", head: true })
        .eq("created_by", profile.id)
        .gte("created_at", since.toISOString());
      if ((count ?? 0) >= MAX_ROUTES_PER_DAY) {
        throw new Error(
          `You've hit the limit of ${MAX_ROUTES_PER_DAY} routes per day. Try again tomorrow.`,
        );
      }

      const photoUrl = await uploadFile(photo, "photo");
      const videoUrl = video ? await uploadFile(video, "video") : null;

      const { data: route, error: insErr } = await supabase
        .from("routes")
        .insert({
          gym_id: profile.home_gym_id,
          photo_url: photoUrl,
          video_url: videoUrl,
          hold_color: holdColor!,
          wall_section: resolvedSection,
          climbing_type: climbingType,
          description: description.trim() || null,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (insErr) {
        if (insErr.message.includes("rate_limit")) {
          throw new Error(
            `You've hit the limit of ${MAX_ROUTES_PER_DAY} routes per day. Try again tomorrow.`,
          );
        }
        throw insErr;
      }

      if (grade !== null && route) {
        await supabase
          .from("grades")
          .insert({ route_id: route.id, user_id: profile.id, grade });
      }

      navigate(`/route/${route!.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add route.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <AppHeader title="Add a route" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 p-5">
        {/* Climbing type */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Climbing type</p>
          <div className="flex gap-2">
            {CLIMB_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => changeType(t.value)}
                className={`flex-1 rounded-2xl border py-3 text-sm font-semibold transition ${
                  climbingType === t.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-muted hover:text-chalk"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Photo (required) */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Photo</p>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickPhoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-surface-2 text-faint"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Selected route"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-2">
                <ImagePlus size={32} />
                <span className="text-sm">Tap to add a photo</span>
              </span>
            )}
          </button>
          {photoPreview ? (
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="mt-2 flex items-center gap-1 text-sm text-accent"
            >
              <Camera size={15} /> Change photo
            </button>
          ) : null}
        </div>

        {/* Video (optional) */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">
            Video <span className="text-faint">(optional, MP4/MOV, ≤50MB)</span>
          </p>
          <input
            ref={videoRef}
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={onPickVideo}
            className="hidden"
          />
          {videoPreview ? (
            <div className="relative overflow-hidden rounded-3xl border border-border bg-black">
              <video
                src={videoPreview}
                className="aspect-[4/3] w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
              <button
                type="button"
                onClick={clearVideo}
                className="absolute right-3 top-3 rounded-full bg-bg/70 p-2 text-chalk backdrop-blur"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface py-3 text-sm text-muted hover:text-chalk"
            >
              <Film size={18} /> Add a video
            </button>
          )}
        </div>

        {/* Hold color */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Hold color</p>
          <div className="grid grid-cols-5 gap-2">
            {HOLD_COLORS.map((c) => {
              const selected = holdColor === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setHoldColor(c.name)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                    selected
                      ? "border-accent bg-surface-2"
                      : "border-border bg-surface"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-white/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[10px] text-muted">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wall section */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Wall section</p>
          <div className="flex flex-wrap gap-2">
            {WALL_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  section === s
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface text-muted hover:text-chalk"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSection("__custom")}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                section === "__custom"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-muted hover:text-chalk"
              }`}
            >
              Custom
            </button>
          </div>
          {section === "__custom" ? (
            <Input
              className="mt-2"
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              placeholder="Name the section"
            />
          ) : null}
        </div>

        {/* Optional grade */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">
            Your grade guess <span className="text-faint">(optional)</span>
          </p>
          <GradePicker
            value={grade}
            onChange={setGrade}
            climbingType={climbingType}
            system={system}
          />
        </div>

        {/* Description */}
        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Start matched on the jug, big move to the sloper…"
        />

        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={busy} className="w-full">
          Add route
        </Button>
      </form>

      {/* Gym confirmation prompt */}
      {confirming ? (
        <div className="fixed inset-0 z-30 mx-auto flex max-w-app animate-fade-in items-end bg-black/60 p-4">
          <div className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-lg font-bold text-chalk">Confirm gym</h3>
            <p className="mt-2 text-sm text-muted">
              You're adding this route to{" "}
              <span className="font-semibold text-chalk">
                {gymName ?? "your gym"}
              </span>
              . Is that correct?
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button className="w-full" onClick={create}>
                Yes, add it
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/gym/select")}
              >
                Change gym
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setConfirming(false)}
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

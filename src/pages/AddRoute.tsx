import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImagePlus } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  HOLD_COLORS,
  holdHex,
  type ClimbType,
} from "../lib/constants";
import { pickerOptions, type GradeStyle } from "../lib/grades";
import { ensureGymUnlocked } from "../lib/location";
import { pickPhotoNative } from "../lib/photo";
import { AppHeader } from "../components/Layout";
import { Button, ErrorText, Input, Textarea } from "../components/ui";
import { contentTextError } from "../lib/nameModeration";
import { Dropdown } from "../components/Dropdown";
import { ClimbTypePicker } from "../components/log/ClimbTypePicker";
import {
  IMAGE_ACCEPT,
  imageContentError,
  imageUploadError,
} from "../lib/uploadSecurity";
import { secureImageUpload } from "../lib/secureImageUpload";

const NOT_SURE = "Not sure";
const NOT_SET = "Not set";

// Shown when a climb is logged without a photo — a quiet dark placeholder.
const NO_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='#1b1e1c'/><path d='M110 205 L175 125 L215 172 L250 140 L300 205 Z' fill='#2a2f2c'/><circle cx='250' cy='95' r='16' fill='#2a2f2c'/></svg>",
  );

export function AddRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);

  // Add to whichever gym you're currently browsing (home, or one you're visiting).
  const targetGymId = profile?.visiting_gym_id ?? profile?.home_gym_id ?? null;
  const [gymName, setGymName] = useState<string | null>(null);
  const [gymCoords, setGymCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [gradeStyle, setGradeStyle] = useState<GradeStyle>("classic");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [climbingType, setClimbingType] = useState<ClimbType>("boulder");
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [gymGrade, setGymGrade] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const system = profile?.grade_system ?? "american";
  const gradeOptions = pickerOptions(climbingType, system, gradeStyle);
  const labelOf = (g: number | null, fallback: string) =>
    g === null
      ? fallback
      : gradeOptions.find((o) => o.value === g)?.label ?? fallback;

  useEffect(() => {
    if (!targetGymId) return;
    supabase
      .from("gyms")
      .select("name, latitude, longitude, grading_style")
      .eq("id", targetGymId)
      .maybeSingle()
      .then(({ data }) => {
        setGymName(data?.name ?? null);
        setGradeStyle(data?.grading_style ?? "classic");
        setGymCoords(
          data?.latitude != null && data?.longitude != null
            ? { lat: data.latitude, lng: data.longitude }
            : null,
        );
      });
  }, [targetGymId]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const validationError = imageUploadError(f);
    if (validationError) {
      e.target.value = "";
      setError(validationError);
      return;
    }
    setError(null);
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function choosePhoto() {
    setError(null);
    try {
      const picked = await pickPhotoNative();
      if (picked === undefined) {
        photoRef.current?.click();
        return;
      }
      if (!picked) return;
      const validationError = imageUploadError(picked.file);
      if (validationError) return setError(validationError);
      setPhoto(picked.file);
      setPhotoPreview(picked.previewUrl);
    } catch (photoError) {
      const message =
        photoError instanceof Error ? photoError.message : String(photoError);
      setError(`Couldn't open the camera: ${message}`);
    }
  }

  function changeType(t: ClimbType) {
    setClimbingType(t);
    setGrade(null);
    setGymGrade(null);
  }

  function validate(): string | null {
    if (!holdColor) return "Pick the hold color.";
    if (!targetGymId) return "No gym selected.";
    return contentTextError([
      { label: "the route name", value: routeName },
      { label: "the description", value: description },
    ]);
  }

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
    const validationError = imageUploadError(file);
    if (validationError) throw new Error(validationError);
    const contentError = await imageContentError(file);
    if (contentError) throw new Error(contentError);
    void suffix;
    return (await secureImageUpload(file, "route")).publicUrl;
  }

  async function create() {
    if (!targetGymId) return;
    setConfirming(false);
    setBusy(true);
    try {
      if (!profile) throw new Error("You need to be signed in to add a route.");

      // Use the same first-visit rule as normal logging. Once this climber has
      // verified a gym, adding another route there should not repeatedly fail
      // just because location is briefly unavailable or they are reviewing the
      // logbook from home.
      const unlock = await ensureGymUnlocked(profile.id, targetGymId, {
        name: gymName,
        latitude: gymCoords?.lat ?? null,
        longitude: gymCoords?.lng ?? null,
      });
      if (!unlock.ok) {
        throw new Error(
          unlock.error ?? "Your first route at this gym must be added nearby.",
        );
      }

      const photoUrl = photo ? await uploadFile(photo, "photo") : NO_PHOTO;

      const { data: route, error: insErr } = await supabase
        .from("routes")
        .insert({
          gym_id: targetGymId,
          photo_url: photoUrl,
          video_url: null,
          hold_color: holdColor!,
          climbing_type: climbingType,
          gym_grade: gymGrade,
          name: routeName.trim() || null,
          description: description.trim() || null,
          created_by: profile!.id,
        })
        .select("id")
        .single();
      if (insErr) {
        throw insErr;
      }

      if (grade !== null && route) {
        await supabase
          .from("grades")
          .insert({ route_id: route.id, user_id: profile!.id, grade });
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
      <AppHeader title="Add a route" subtitle={gymName ?? undefined} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 p-5">
        {/* Climbing type — sliding segmented */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Climbing type</p>
          <ClimbTypePicker value={climbingType} onChange={changeType} />
        </div>

        {/* Photo (required) */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">Photo</p>
          <input
            ref={photoRef}
            type="file"
            accept={IMAGE_ACCEPT}
            capture="environment"
            onChange={onPickPhoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={choosePhoto}
            className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl bg-surface-2 text-faint"
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
              onClick={choosePhoto}
              className="mt-2 flex items-center gap-1 text-sm text-accent"
            >
              <Camera size={15} /> Change photo
            </button>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Route photos are shared with climbers viewing this gym. Don&apos;t
            upload private information or an image you do not have permission
            to use.
          </p>
        </div>

        {/* Details as clean dropdowns */}
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
          <Row label="Hold color">
            <Dropdown
              value={holdColor ?? "Choose"}
              options={HOLD_COLORS.map((c) => c.name)}
              onChange={setHoldColor}
              align="right"
            />
          </Row>
          {holdColor ? (
            <div className="flex items-center gap-2 text-xs text-faint">
              <span
                className={`h-3 w-3 rounded-full ${holdColor === "White" ? "border border-black/15" : ""}`}
                style={{ backgroundColor: holdHex(holdColor) }}
              />
              {holdColor} holds
            </div>
          ) : null}
          <Input
            label="Route name (optional)"
            value={routeName}
            onChange={(event) => setRouteName(event.target.value)}
            placeholder="e.g. The Green Mile"
            maxLength={80}
          />

          <Row label="Your grade guess">
            <Dropdown
              value={labelOf(grade, NOT_SURE)}
              options={[NOT_SURE, ...gradeOptions.map((o) => o.label)]}
              onChange={(l) =>
                setGrade(
                  l === NOT_SURE
                    ? null
                    : gradeOptions.find((o) => o.label === l)?.value ?? null,
                )
              }
              align="right"
            />
          </Row>

          <Row label="Gym's grade">
            <Dropdown
              value={labelOf(gymGrade, NOT_SET)}
              options={[NOT_SET, ...gradeOptions.map((o) => o.label)]}
              onChange={(l) =>
                setGymGrade(
                  l === NOT_SET
                    ? null
                    : gradeOptions.find((o) => o.label === l)?.value ?? null,
                )
              }
              align="right"
            />
          </Row>
          <p className="text-xs text-faint">
            "Gym's grade" is the official grade the setter posted, if any.
          </p>
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

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-chalk">{label}</span>
      {children}
    </div>
  );
}

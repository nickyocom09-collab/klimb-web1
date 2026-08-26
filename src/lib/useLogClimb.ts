import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { pickPhotoNative, type PhotoSource } from "./photo";
import type { ClimbType } from "./constants";
import { ensureGymUnlocked } from "./location";
import { PLACEHOLDER_PHOTO } from "./personalLogs";
import { contentTextError } from "./nameModeration";
import {
  imageContentError,
  imageUploadError,
} from "./uploadSecurity";
import { secureImageUpload } from "./secureImageUpload";
import { pickVideoFromLibrary } from "./videoPicker";
import {
  gymGradeOptions,
  pickerOptions,
  type GradeStyle,
} from "./grades";
import { DEFAULT_LOGBOOK_PREFERENCES, useLogbookPreferences } from "./logbookPreferences";
import { useEntitlements } from "./entitlements";
import { secureVideoUpload, validateVideoForUpload } from "./secureVideoUpload";

export const NOT_SET = "Not set";
export const OTHER = "Other…";

export type Outcome = "flash" | "send" | "project";

export type OutcomeOption = {
  value: Outcome;
  label: string;
  hint: string;
};

export function outcomesFor(type: ClimbType): OutcomeOption[] {
  const flash: OutcomeOption = { value: "flash", label: "Flash", hint: "First try" };
  const project: OutcomeOption = { value: "project", label: "Project", hint: "Working it" };
  return [
    flash,
    { value: "send", label: "Sent", hint: type === "boulder" ? "Clean" : "No falls" },
    project,
  ];
}

export const REWARD: Record<Outcome, { title: string; sub: string }> = {
  flash: { title: "Flashed!", sub: "First try. Filthy." },
  send: { title: "Sent!", sub: "Another one for the book." },
  project: { title: "On the board", sub: "Saved to your projects." },
};

/**
 * All the state, derived values, and the single save path for the log flow —
 * shared by both the single-screen form and the stepped one-at-a-time flow so
 * the two presentations behave identically and only differ in layout.
 */
export function useLogClimb() {
  const { profile } = useAuth();
  const { hasProAccess } = useEntitlements();
  const { preferences } = useLogbookPreferences();
  const routeNamesEnabled = profile?.route_names_enabled ?? false;
  const logbookPreferences = hasProAccess
    ? { ...preferences, show_route_name: routeNamesEnabled }
    : DEFAULT_LOGBOOK_PREFERENCES;
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const system = profile?.grade_system ?? "american";
  // Route names are a core Free preference. Pro mirrors this value into the
  // customizable logbook record, while the profile flag remains the single
  // source of truth used by both logging layouts.
  // Log at the gym you're actually at — a "visiting" gym wins over home.
  const gymId = profile?.visiting_gym_id ?? profile?.home_gym_id ?? null;
  // Off-grid: a user who chose to log without a gym (no home gym, but a gym
  // label they're waiting on) saves to their private personal logbook instead.
  const offgridLabel = profile?.offgrid_gym_label ?? null;
  const offGrid = !gymId && !!offgridLabel;

  const [gymName, setGymName] = useState<string | null>(null);
  const [gymCoords, setGymCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  } | null>(null);
  const [gradeStyle, setGradeStyle] = useState<GradeStyle>("classic");
  const [pendingGymId, setPendingGymId] = useState<string | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [climbingType, setClimbingType] = useState<ClimbType>("boulder");
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [gymGrade, setGymGrade] = useState<number | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [shareToProfile, setShareToProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<Outcome | null>(null);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);

  useEffect(() => {
    if (!gymId) return;
    supabase
      .from("gyms")
      .select("name, grading_style, latitude, longitude")
      .eq("id", gymId)
      .maybeSingle()
      .then(({ data }) => {
        setGymName(data?.name ?? null);
        setGradeStyle(data?.grading_style ?? "classic");
        setGymCoords(
          data
            ? { latitude: data.latitude, longitude: data.longitude }
            : null,
        );
      });
  }, [gymId]);

  useEffect(() => {
    setShareToProfile(logbookPreferences.default_profile_visible);
  }, [logbookPreferences.default_profile_visible]);

  // Link personal logs to the user's pending gym suggestion when possible.
  // This gives the later transfer an exact gym id instead of relying only on a
  // name match after the suggestion is approved.
  useEffect(() => {
    if (!offGrid || !profile || !offgridLabel) {
      setPendingGymId(null);
      return;
    }
    let active = true;
    supabase
      .from("gyms")
      .select("id")
      .eq("created_by", profile.id)
      .eq("status", "pending")
      .ilike("name", offgridLabel)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPendingGymId(data?.id ?? null);
      });
    return () => {
      active = false;
    };
  }, [offGrid, offgridLabel, profile]);

  const gymGradeOpts = gymGradeOptions(climbingType, system, gradeStyle);
  const feltOpts = pickerOptions(climbingType, system);
  const outcomeOptions = outcomesFor(climbingType);
  const gymGradeLabel =
    gymGrade === null
      ? NOT_SET
      : gymGradeOpts.find((o) => o.value === gymGrade)?.label ??
        feltOpts.find((o) => o.value === gymGrade)?.label ??
        NOT_SET;

  // Web path: the hidden <input type="file"> change handler.
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

  function pickPhoto() {
    if (!Capacitor.isNativePlatform()) {
      photoRef.current?.click();
      return;
    }
    setPhotoSourceOpen(true);
  }

  async function setSelectedVideo(selected: File | null) {
    if (!selected) return;
    const validationError = await validateVideoForUpload(selected);
    if (validationError) {
      setVideo(null);
      setError(validationError);
      return;
    }
    setError(null);
    setVideo(selected);
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    // Reset the browser fallback so the same clip can be selected again after
    // trimming it. Native iOS selection does not use this input.
    e.target.value = "";
    await setSelectedVideo(selected);
  }

  async function pickVideo() {
    try {
      const selected = await pickVideoFromLibrary();
      if (selected === undefined) {
        videoRef.current?.click();
        return;
      }
      await setSelectedVideo(selected);
    } catch (videoError) {
      const message =
        videoError instanceof Error ? videoError.message : String(videoError);
      setError(`Couldn't open your video library: ${message}`);
    }
  }

  async function pickPhotoFrom(source: PhotoSource) {
    setPhotoSourceOpen(false);
    setError(null);
    try {
      const picked = await pickPhotoNative(source);
      if (!picked) return;
      const validationError = imageUploadError(picked.file);
      if (validationError) return setError(validationError);
      setPhoto(picked.file);
      setPhotoPreview(picked.previewUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Couldn't open the camera: ${message}`);
    }
  }

  function changeType(t: ClimbType) {
    setClimbingType(t);
    setFeltGrade(null);
    setGymGrade(null);
  }

  async function save() {
    // Validate quietly and inline — no popups mid-form. Photo is optional.
    if (logbookPreferences.show_hold_color && !holdColor) return setError("Pick the hold color.");
    if (!outcome) return setError("How'd it go? Flash, Sent, or Project.");
    if (!profile) return setError("You need to be signed in to log.");
    if (!gymId && !offGrid) return setError("Pick a home gym first.");
    const moderationError = contentTextError([
      { label: "the route name", value: routeName },
      { label: "the note", value: note },
    ]);
    if (moderationError) return setError(moderationError);
    setError(null);
    setBusy(true);
    let uploadedPhotoPath: string | null = null;
    try {
      // The first log at a gym proves proximity and permanently unlocks it.
      // Later logs (and the full logbook) work from anywhere. Off-grid climbs
      // have no gym location and remain private until transferred.
      if (!offGrid) {
        const unlock = await ensureGymUnlocked(profile.id, gymId!, {
          name: gymName,
          latitude: gymCoords?.latitude ?? null,
          longitude: gymCoords?.longitude ?? null,
        });
        if (!unlock.ok) {
          setBusy(false);
          return setError(
            unlock.error ?? "Your first log must be within 30 miles of this gym.",
          );
        }
      }
      // 1) The route itself — yours, on your gym. Photo optional; without one
      // we store a quiet dark placeholder.
      let photoUrl = PLACEHOLDER_PHOTO;
      if (photo) {
        const validationError = imageUploadError(photo);
        if (validationError) throw new Error(validationError);
        const contentError = await imageContentError(photo);
        if (contentError) throw new Error(contentError);
        const upload = await secureImageUpload(photo, "route");
        uploadedPhotoPath = upload.path;
        photoUrl = upload.publicUrl;
      }

      if (offGrid) {
        // Off-grid: save to the private personal logbook. No gym, no proximity,
        // no community exposure — just the climb, kept for the user until their
        // gym is added and they transfer it over. Columns mirror log_climb so
        // the later transfer is a clean 1:1 mapping.
        const { error: plError } = await supabase.from("personal_logs").insert({
          user_id: profile.id,
          gym_label: offgridLabel,
          pending_gym_id: pendingGymId,
          climbing_type: climbingType,
          hold_color: holdColor ?? NOT_SET,
          route_name: routeName.trim() || null,
          gym_grade: gymGrade,
          felt_grade: feltGrade,
          outcome,
          stars,
          note: note.trim() || null,
          photo_url: photoUrl,
          profile_visible: shareToProfile,
        });
        if (plError) throw plError;
      } else {
        // Save every database row as one transaction. A failure in the grade,
        // rating, send, bookmark, or project note rolls the new route back too.
        const { data: loggedRouteId, error: logError } = await supabase.rpc("log_climb", {
          p_gym_id: gymId!,
          p_photo_url: photoUrl,
          p_hold_color: holdColor ?? NOT_SET,
          p_climbing_type: climbingType,
          p_gym_grade: gymGrade,
          p_felt_grade: feltGrade,
          p_stars: stars,
          p_outcome: outcome,
          p_note: note,
          p_name: routeName.trim() || null,
          p_profile_visible: shareToProfile,
        });
        if (logError) throw logError;
        if (video && hasProAccess && loggedRouteId) {
          try {
            await secureVideoUpload(video, loggedRouteId, "");
          } catch (videoError) {
            // The Klimb is already committed atomically. A media-network error
            // must never encourage a retry that would duplicate the log.
            setError(
              videoError instanceof Error
                ? `Your Klimb was saved, but the video wasn't added: ${videoError.message}`
                : "Your Klimb was saved, but the video wasn't added.",
            );
          }
        }
      }

      // The reward moment lives HERE, on the initial log — identical off-grid.
      setBusy(false);
      setReward(outcome);
      // Projects and sends both drop you back Home after the reward — a project
      // is saved to your list, not "completed," so we don't shove the user onto
      // the project's Complete-it screen right after creating it.
      setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (err) {
      if (uploadedPhotoPath) {
        await supabase.storage
          .from("route-photos")
          .remove([uploadedPhotoPath])
          .catch(() => undefined);
      }
      setBusy(false);
      const message =
        err instanceof Error ? err.message : "Couldn't save the climb.";
      setError(
        /invalid input value for enum climbing_type.*lead/i.test(message)
          ? "Lead logging needs the latest Klimb database update."
          : message,
      );
    }
  }

  return {
    // meta
    profile,
    navigate,
    gymId,
    gymName,
    offGrid,
    offgridLabel,
    system,
    routeNamesEnabled,
    logbookPreferences,
    photoRef,
    videoRef,
    hasProAccess,
    // state
    photo,
    photoPreview,
    video,
    climbingType,
    holdColor,
    routeName,
    outcome,
    feltGrade,
    gymGrade,
    stars,
    note,
    shareToProfile,
    error,
    busy,
    reward,
    photoSourceOpen,
    // setters
    setHoldColor,
    setRouteName,
    setOutcome,
    setFeltGrade,
    setGymGrade,
    setStars,
    setNote,
    setShareToProfile,
    setError,
    setPhotoSourceOpen,
    // derived
    gymGradeOpts,
    outcomeOptions,
    gymGradeLabel,
    // actions
    onPickPhoto,
    onPickVideo,
    pickVideo,
    pickPhoto,
    pickPhotoFrom,
    changeType,
    save,
  };
}

export type LogClimbState = ReturnType<typeof useLogClimb>;

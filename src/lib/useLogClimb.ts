import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { pickPhotoNative, type PhotoSource } from "./photo";
import type { ClimbType } from "./constants";
import { assertNearGym } from "./location";
import { PLACEHOLDER_PHOTO } from "./personalLogs";
import {
  gymGradeOptions,
  pickerOptions,
  type GradeStyle,
} from "./grades";

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
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const system = profile?.grade_system ?? "american";
  const routeNamesEnabled = profile?.route_names_enabled ?? false;
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

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [climbingType, setClimbingType] = useState<ClimbType>("boulder");
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [gymGrade, setGymGrade] = useState<number | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
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

  async function pickPhotoFrom(source: PhotoSource) {
    setPhotoSourceOpen(false);
    setError(null);
    try {
      const picked = await pickPhotoNative(source);
      if (!picked) return;
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
    if (!holdColor) return setError("Pick the hold color.");
    if (!outcome) return setError("How'd it go? Flash, Sent, or Project.");
    if (!profile) return setError("You need to be signed in to log.");
    if (!gymId && !offGrid) return setError("Pick a home gym first.");
    setError(null);
    setBusy(true);
    let uploadedPhotoPath: string | null = null;
    try {
      // Anti-cheat: you must actually be at the gym to log a climb there. Off-
      // grid climbs have no gym location, so there's nothing to be near — skip
      // the proximity check entirely for them.
      if (!offGrid) {
        const near = await assertNearGym({
          name: gymName,
          latitude: gymCoords?.latitude ?? null,
          longitude: gymCoords?.longitude ?? null,
        });
        if (!near.ok) {
          setBusy(false);
          return setError(
            near.error ?? "Get within range of your gym to log a Klimb.",
          );
        }
      }
      // 1) The route itself — yours, on your gym. Photo optional; without one
      // we store a quiet dark placeholder.
      let photoUrl = PLACEHOLDER_PHOTO;
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${profile.id}/${Date.now()}-photo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("route-photos")
          .upload(path, photo, { contentType: photo.type });
        if (upErr) throw upErr;
        uploadedPhotoPath = path;
        photoUrl = supabase.storage
          .from("route-photos")
          .getPublicUrl(path).data.publicUrl;
      }

      if (offGrid) {
        // Off-grid: save to the private personal logbook. No gym, no proximity,
        // no community exposure — just the climb, kept for the user until their
        // gym is added and they transfer it over. Columns mirror log_climb so
        // the later transfer is a clean 1:1 mapping.
        const { error: plError } = await supabase.from("personal_logs").insert({
          user_id: profile.id,
          gym_label: offgridLabel,
          climbing_type: climbingType,
          hold_color: holdColor,
          route_name: routeName.trim() || null,
          gym_grade: gymGrade,
          felt_grade: feltGrade,
          outcome,
          stars,
          note: note.trim() || null,
          photo_url: photoUrl,
        });
        if (plError) throw plError;
      } else {
        // Save every database row as one transaction. A failure in the grade,
        // rating, send, bookmark, or project note rolls the new route back too.
        const { error: logError } = await supabase.rpc("log_climb", {
          p_gym_id: gymId!,
          p_photo_url: photoUrl,
          p_hold_color: holdColor,
          p_climbing_type: climbingType,
          p_gym_grade: gymGrade,
          p_felt_grade: feltGrade,
          p_stars: stars,
          p_outcome: outcome,
          p_note: note,
          p_name: routeName.trim() || null,
        });
        if (logError) throw logError;
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
    photoRef,
    // state
    photo,
    photoPreview,
    climbingType,
    holdColor,
    routeName,
    outcome,
    feltGrade,
    gymGrade,
    stars,
    note,
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
    setError,
    setPhotoSourceOpen,
    // derived
    gymGradeOpts,
    outcomeOptions,
    gymGradeLabel,
    // actions
    onPickPhoto,
    pickPhoto,
    pickPhotoFrom,
    changeType,
    save,
  };
}

export type LogClimbState = ReturnType<typeof useLogClimb>;

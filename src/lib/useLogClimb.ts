import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { type ClimbType } from "./constants";
import {
  gymGradeOptions,
  pickerOptions,
  type GradeStyle,
} from "./grades";

export const NOT_SET = "Not set";
export const OTHER = "Other…";

export type Outcome = "flash" | "send" | "topped" | "project";

export type OutcomeOption = {
  value: Outcome;
  label: string;
  hint: string;
};

// Rope climbs get the extra "Topped" state (reached the anchor, but with
// falls) between Sent and Project; boulders just top out or don't.
export function outcomesFor(type: ClimbType): OutcomeOption[] {
  const flash: OutcomeOption = { value: "flash", label: "Flash", hint: "First try" };
  const project: OutcomeOption = { value: "project", label: "Project", hint: "Working it" };
  if (type === "toprope") {
    return [
      flash,
      { value: "send", label: "Sent", hint: "No falls" },
      { value: "topped", label: "Topped", hint: "With falls" },
      project,
    ];
  }
  return [flash, { value: "send", label: "Sent", hint: "Clean" }, project];
}

export const REWARD: Record<Outcome, { title: string; sub: string }> = {
  flash: { title: "Flashed!", sub: "First try. Filthy." },
  send: { title: "Sent!", sub: "Another one for the book." },
  topped: { title: "Topped!", sub: "Made the anchor — go back for the clean send." },
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
  // Log at the gym you're actually at — a "visiting" gym wins over home.
  const gymId = profile?.visiting_gym_id ?? profile?.home_gym_id ?? null;

  const [gymName, setGymName] = useState<string | null>(null);
  const [gradeStyle, setGradeStyle] = useState<GradeStyle>("classic");

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [climbingType, setClimbingType] = useState<ClimbType>("boulder");
  const [holdColor, setHoldColor] = useState<string | null>(null);
  const [section, setSection] = useState("");
  const [customSection, setCustomSection] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feltGrade, setFeltGrade] = useState<number | null>(null);
  const [gymGrade, setGymGrade] = useState<number | null>(null);
  const [stars, setStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!gymId) return;
    supabase
      .from("gyms")
      .select("name, grading_style")
      .eq("id", gymId)
      .maybeSingle()
      .then(({ data }) => {
        setGymName(data?.name ?? null);
        setGradeStyle(data?.grading_style ?? "classic");
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
  const resolvedSection = section === OTHER ? customSection.trim() : section;

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  function changeType(t: ClimbType) {
    setClimbingType(t);
    setFeltGrade(null);
    setGymGrade(null);
    // "Topped" only exists for rope climbs — drop it if switching to boulder.
    if (t !== "toprope" && outcome === "topped") setOutcome(null);
  }

  async function save() {
    // Validate quietly and inline — no popups mid-form. Photo is optional.
    if (!holdColor) return setError("Pick the hold color.");
    if (!resolvedSection) return setError("Choose or enter a wall section.");
    if (!outcome) return setError("How'd it go? Flash, Sent, or Project.");
    if (!gymId || !profile) return setError("Pick a home gym first.");
    setError(null);
    setBusy(true);
    try {
      // 1) The route itself — yours, on your gym. Photo optional; without one
      // we store a quiet dark placeholder.
      let photoUrl =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='#1b1e1c'/><path d='M110 205 L175 125 L215 172 L250 140 L300 205 Z' fill='#2a2f2c'/><circle cx='250' cy='95' r='16' fill='#2a2f2c'/></svg>",
        );
      if (photo) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${profile.id}/${Date.now()}-photo.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("route-photos")
          .upload(path, photo, { contentType: photo.type });
        if (upErr) throw upErr;
        photoUrl = supabase.storage
          .from("route-photos")
          .getPublicUrl(path).data.publicUrl;
      }

      const { data: route, error: insErr } = await supabase
        .from("routes")
        .insert({
          gym_id: gymId,
          photo_url: photoUrl,
          hold_color: holdColor,
          wall_section: resolvedSection,
          climbing_type: climbingType,
          gym_grade: gymGrade,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (insErr || !route) throw insErr ?? new Error("Couldn't save the climb.");

      // 2) Your take: felt grade + quality.
      const writes: PromiseLike<unknown>[] = [];
      if (feltGrade !== null) {
        writes.push(
          supabase.from("grades").insert({
            route_id: route.id,
            user_id: profile.id,
            grade: feltGrade,
          }),
        );
      }
      if (stars !== null) {
        writes.push(
          supabase.from("route_ratings").insert({
            route_id: route.id,
            user_id: profile.id,
            stars,
          }),
        );
      }

      // 3) The log: a send in the book, or a project with its first note.
      const trimmed = note.trim();
      if (outcome === "project") {
        writes.push(
          supabase
            .from("bookmarks")
            .insert({ user_id: profile.id, route_id: route.id, kind: "project" }),
        );
        if (trimmed) {
          writes.push(
            supabase.from("project_notes").insert({
              user_id: profile.id,
              route_id: route.id,
              body: trimmed,
            }),
          );
        }
      } else {
        writes.push(
          supabase.from("sends").insert({
            route_id: route.id,
            user_id: profile.id,
            send_type: outcome,
            attempts: 1,
            note: trimmed || null,
          }),
        );
      }
      await Promise.all(writes);

      // The reward moment lives HERE, on the initial log.
      setBusy(false);
      setReward(outcome);
      const dest = outcome === "project" ? `/project/${route.id}` : "/";
      setTimeout(() => navigate(dest, { replace: true }), 1200);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't save the climb.");
    }
  }

  return {
    // meta
    profile,
    navigate,
    gymId,
    gymName,
    system,
    photoRef,
    // state
    photo,
    photoPreview,
    climbingType,
    holdColor,
    section,
    customSection,
    outcome,
    feltGrade,
    gymGrade,
    stars,
    note,
    error,
    busy,
    reward,
    // setters
    setHoldColor,
    setSection,
    setCustomSection,
    setOutcome,
    setFeltGrade,
    setGymGrade,
    setStars,
    setNote,
    setError,
    // derived
    gymGradeOpts,
    outcomeOptions,
    gymGradeLabel,
    resolvedSection,
    // actions
    onPickPhoto,
    changeType,
    save,
  };
}

export type LogClimbState = ReturnType<typeof useLogClimb>;

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookmark, Camera, Check, ImagePlus, Zap } from "lucide-react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  CLIMB_TYPES,
  HOLD_COLORS,
  holdHex,
  WALL_SECTIONS,
  type ClimbType,
} from "../lib/constants";
import {
  gymGradeOptions,
  pickerOptions,
  type GradeStyle,
} from "../lib/grades";
import { AppHeader } from "../components/Layout";
import { Button, ErrorText, Input, SlideTabs, Textarea } from "../components/ui";
import { Dropdown } from "../components/Dropdown";
import { GradePicker } from "../components/GradePicker";
import { Stars } from "../components/Stars";

const NOT_SET = "Not set";
const OTHER = "Other…";

type Outcome = "flash" | "send" | "project";

const OUTCOMES: {
  value: Outcome;
  label: string;
  hint: string;
  Icon: typeof Zap;
}[] = [
  { value: "flash", label: "Flash", hint: "First try", Icon: Zap },
  { value: "send", label: "Sent", hint: "Topped it", Icon: Check },
  { value: "project", label: "Project", hint: "Working on it", Icon: Bookmark },
];

const REWARD: Record<Outcome, { title: string; sub: string }> = {
  flash: { title: "Flashed!", sub: "First try. Filthy." },
  send: { title: "Sent!", sub: "Another one for the book." },
  project: { title: "On the board", sub: "Saved to your projects." },
};

/**
 * THE log flow — one screen, one save. You describe the climb (photo, color,
 * wall, type), say how it went (Flash / Sent / Project), and everything is
 * created together: the route, your grade, your rating, and either a send in
 * your logbook or a project with your first journal note. No confirm popups,
 * no separate add-route step, and the reward moment fires right here.
 */
export function LogClimb() {
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

  if (!gymId) {
    return (
      <div>
        <AppHeader title="Log a climb" subtitle="Your gym" />
        <div className="flex flex-col items-center gap-4 px-8 py-20 text-center">
          <p className="text-faint">Pick a home gym to start logging climbs.</p>
          <Button onClick={() => navigate("/gym/select")}>Choose a gym</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <AppHeader title="Log a climb" subtitle={gymName ?? undefined} />
      <div className="flex flex-col gap-5 p-5">
        {/* How'd it go? The heart of the log. */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">How'd it go?</p>
          <div className="grid grid-cols-3 gap-2">
            {OUTCOMES.map(({ value, label, hint, Icon }) => {
              const on = outcome === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutcome(value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border py-3.5 transition ${
                    on
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-surface-2 text-muted hover:text-chalk"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-bold">{label}</span>
                  <span className="text-[10px] text-faint">{hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Photo */}
        <div>
          <p className="mb-2 ml-1 text-sm text-muted">
            Photo <span className="text-faint">(optional)</span>
          </p>
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
            className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl bg-surface-2 text-faint"
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Selected climb"
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

        {/* The climb */}
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
          <SlideTabs value={climbingType} onChange={changeType} options={CLIMB_TYPES} />
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
                className="h-3 w-3 rounded-full border border-white/10"
                style={{ backgroundColor: holdHex(holdColor) }}
              />
              {holdColor} holds
            </div>
          ) : null}
          <Row label="Wall section">
            <Dropdown
              value={section || "Choose"}
              options={[...WALL_SECTIONS, OTHER]}
              onChange={setSection}
              align="right"
            />
          </Row>
          {section === OTHER ? (
            <Input
              value={customSection}
              onChange={(e) => setCustomSection(e.target.value)}
              placeholder="Name the section"
            />
          ) : null}
          <Row label="Gym's grade">
            <Dropdown
              value={gymGradeLabel}
              options={[NOT_SET, ...gymGradeOpts.map((o) => o.label)]}
              onChange={(l) =>
                setGymGrade(
                  l === NOT_SET
                    ? null
                    : gymGradeOpts.find((o) => o.label === l)?.value ?? null,
                )
              }
              align="right"
            />
          </Row>
        </div>

        {/* Your take */}
        <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
              Felt grade
              <span className="ml-1 font-normal normal-case text-faint">
                (optional)
              </span>
            </p>
            <GradePicker
              value={feltGrade}
              onChange={setFeltGrade}
              climbingType={climbingType}
              system={system}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-faint">
              Quality
            </p>
            <Stars value={stars} onChange={setStars} size={22} />
          </div>
        </div>

        {/* Note — becomes the project's first journal entry for projects */}
        <Textarea
          label={outcome === "project" ? "Project notes (optional)" : "Note (optional)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            outcome === "project"
              ? "Beta, what's not working, what to try next…"
              : "How'd it feel?"
          }
          maxLength={500}
        />

        <ErrorText>{error}</ErrorText>
        <Button loading={busy} onClick={save} className="w-full">
          {outcome === "project" ? "Save project" : "Log it"}
        </Button>
      </div>

      {/* Reward moment — fires on the initial log, right here. */}
      {reward ? (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in flex-col items-center justify-center gap-3 bg-bg/95 backdrop-blur-sm">
          <span className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-accent/25 animate-pulse-ring" />
            <span className="flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-accent text-bg shadow-glow">
              {reward === "flash" ? (
                <Zap size={30} strokeWidth={2.5} />
              ) : reward === "project" ? (
                <Bookmark size={28} strokeWidth={2.5} />
              ) : (
                <Check size={32} strokeWidth={3} />
              )}
            </span>
          </span>
          <p className="animate-fade-up text-2xl font-extrabold text-chalk [animation-delay:120ms]">
            {REWARD[reward].title}
          </p>
          <p className="animate-fade-up text-sm text-muted [animation-delay:200ms]">
            {REWARD[reward].sub}
          </p>
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

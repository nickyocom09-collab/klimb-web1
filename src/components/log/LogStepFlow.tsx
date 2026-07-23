import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, ImagePlus } from "lucide-react";
import { CLIMB_TYPES, HOLD_COLORS, holdHex, WALL_SECTIONS } from "../../lib/constants";
import { NOT_SET, OTHER, type LogClimbState } from "../../lib/useLogClimb";
import { Button, ErrorText, Input, SlideTabs, Textarea } from "../ui";
import { Dropdown } from "../Dropdown";
import { GradePicker } from "../GradePicker";
import { Stars } from "../Stars";
import { OUTCOME_ICON } from "./outcomeIcon";

type Step = {
  key: string;
  title: string;
  hint?: string;
  optional?: boolean;
  /** Whether Next is allowed to advance from this step. */
  ready: (s: LogClimbState) => boolean;
  render: (s: LogClimbState) => React.ReactNode;
};

const STEPS: Step[] = [
  {
    key: "type",
    title: "What did you climb?",
    ready: () => true,
    render: (s) => (
      <SlideTabs value={s.climbingType} onChange={s.changeType} options={CLIMB_TYPES} />
    ),
  },
  {
    key: "outcome",
    title: "How'd it go?",
    ready: (s) => s.outcome !== null,
    render: (s) => (
      <div
        className={`grid gap-2.5 ${
          s.outcomeOptions.length === 4 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {s.outcomeOptions.map(({ value, label, hint }) => {
          const Icon = OUTCOME_ICON[value];
          const on = s.outcome === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => s.setOutcome(value)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-5 text-center transition ${
                on
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface-2 text-muted hover:text-chalk"
              }`}
            >
              <Icon size={26} />
              <span className="text-sm font-bold leading-none">{label}</span>
              <span className="whitespace-nowrap text-[10px] leading-none text-faint">
                {hint}
              </span>
            </button>
          );
        })}
      </div>
    ),
  },
  {
    key: "photo",
    title: "Add a photo",
    hint: "Optional — helps others spot the line.",
    optional: true,
    ready: () => true,
    render: (s) => (
      <div>
        <input
          ref={s.photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={s.onPickPhoto}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => s.photoRef.current?.click()}
          className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl bg-surface-2 text-faint"
        >
          {s.photoPreview ? (
            <img src={s.photoPreview} alt="Selected climb" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2">
              <ImagePlus size={34} />
              <span className="text-sm">Tap to add a photo</span>
            </span>
          )}
        </button>
        {s.photoPreview ? (
          <button
            type="button"
            onClick={() => s.photoRef.current?.click()}
            className="mt-3 flex items-center gap-1 text-sm text-accent"
          >
            <Camera size={15} /> Change photo
          </button>
        ) : null}
      </div>
    ),
  },
  {
    key: "hold",
    title: "What color are the holds?",
    ready: (s) => !!s.holdColor,
    render: (s) => (
      <div className="grid grid-cols-5 gap-2.5">
        {HOLD_COLORS.map((c) => {
          const on = s.holdColor === c.name;
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => s.setHoldColor(c.name)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 transition ${
                on ? "border-accent bg-accent/10" : "border-border bg-surface-2"
              }`}
            >
              <span
                className="h-7 w-7 rounded-full border border-white/15"
                style={{ backgroundColor: holdHex(c.name) }}
              />
              <span className={`text-[10px] leading-none ${on ? "text-accent" : "text-faint"}`}>
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    ),
  },
  {
    key: "section",
    title: "Which wall?",
    ready: (s) => !!s.resolvedSection,
    render: (s) => (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2.5">
          {[...WALL_SECTIONS, OTHER].map((w) => {
            const on = s.section === w;
            return (
              <button
                key={w}
                type="button"
                onClick={() => s.setSection(w)}
                className={`rounded-2xl border px-3 py-3.5 text-sm font-semibold transition ${
                  on
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface-2 text-muted hover:text-chalk"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
        {s.section === OTHER ? (
          <Input
            value={s.customSection}
            onChange={(e) => s.setCustomSection(e.target.value)}
            placeholder="Name the section"
          />
        ) : null}
      </div>
    ),
  },
  {
    key: "gymGrade",
    title: "What's the gym's grade?",
    hint: "Optional — the tag on the wall, if it has one.",
    optional: true,
    ready: () => true,
    render: (s) => (
      <Dropdown
        value={s.gymGradeLabel}
        options={[NOT_SET, ...s.gymGradeOpts.map((o) => o.label)]}
        onChange={(l) =>
          s.setGymGrade(
            l === NOT_SET
              ? null
              : s.gymGradeOpts.find((o) => o.label === l)?.value ?? null,
          )
        }
      />
    ),
  },
  {
    key: "take",
    title: "Your take",
    hint: "Optional — what did it feel like, and was it any good?",
    optional: true,
    ready: () => true,
    render: (s) => (
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Felt grade
          </p>
          <GradePicker
            value={s.feltGrade}
            onChange={s.setFeltGrade}
            climbingType={s.climbingType}
            system={s.system}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-faint">Quality</p>
          <Stars value={s.stars} onChange={s.setStars} size={24} />
        </div>
      </div>
    ),
  },
  {
    key: "note",
    title: "Any notes?",
    hint: "Optional — beta, how it felt, what to try next.",
    optional: true,
    ready: () => true,
    render: (s) => (
      <Textarea
        value={s.note}
        onChange={(e) => s.setNote(e.target.value)}
        placeholder={
          s.outcome === "project"
            ? "Beta, what's not working, what to try next…"
            : "How'd it feel?"
        }
        maxLength={500}
      />
    ),
  },
];

/** The stepped, one-question-at-a-time log flow. */
export function LogStepFlow({ s }: { s: LogClimbState }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const canAdvance = useMemo(() => step.ready(s), [step, s]);

  const back = () => setI((v) => Math.max(0, v - 1));
  const next = () => {
    if (!canAdvance) return;
    if (last) s.save();
    else setI((v) => Math.min(STEPS.length - 1, v + 1));
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col p-5">
      {/* Progress segments */}
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, k) => (
          <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: k <= i ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Question */}
      <div key={step.key} className="flex-1 animate-fade-up">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-faint">
          Step {i + 1} of {STEPS.length}
        </div>
        <h2 className="mb-1 text-2xl font-extrabold text-chalk">{step.title}</h2>
        {step.hint ? <p className="mb-5 text-sm text-muted">{step.hint}</p> : <div className="mb-5" />}
        {step.render(s)}
      </div>

      <ErrorText>{s.error}</ErrorText>

      {/* Nav */}
      <div className="mt-6 flex items-center gap-3">
        {i > 0 ? (
          <button
            type="button"
            onClick={back}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <Button
          loading={s.busy}
          onClick={next}
          disabled={!canAdvance}
          className="flex-1"
        >
          {last ? (s.outcome === "project" ? "Save project" : "Log it") : (
            <span className="flex items-center justify-center gap-2">
              {step.optional && !changed(step.key, s) ? "Skip" : "Next"}
              <ArrowRight size={18} />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

/** Has the user actually filled the optional step? Drives Skip vs Next label. */
function changed(key: string, s: LogClimbState): boolean {
  switch (key) {
    case "photo":
      return !!s.photoPreview;
    case "gymGrade":
      return s.gymGrade !== null;
    case "take":
      return s.feltGrade !== null || s.stars !== null;
    case "note":
      return s.note.trim().length > 0;
    default:
      return true;
  }
}

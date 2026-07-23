import { Camera, ImagePlus } from "lucide-react";
import { CLIMB_TYPES, HOLD_COLORS, holdHex, WALL_SECTIONS } from "../../lib/constants";
import { NOT_SET, OTHER, type LogClimbState } from "../../lib/useLogClimb";
import { Button, ErrorText, Input, SlideTabs, Textarea } from "../ui";
import { Dropdown } from "../Dropdown";
import { GradePicker } from "../GradePicker";
import { Stars } from "../Stars";
import { OUTCOME_ICON } from "./outcomeIcon";

/** The original one-screen log form: every field on a single scroll. */
export function LogScrollForm({ s }: { s: LogClimbState }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Boulder or rope? First choice — it drives the outcomes and grades. */}
      <div>
        <p className="mb-2 ml-1 text-sm text-muted">Type of climb</p>
        <SlideTabs value={s.climbingType} onChange={s.changeType} options={CLIMB_TYPES} />
      </div>

      {/* How'd it go? The heart of the log. */}
      <div>
        <p className="mb-2 ml-1 text-sm text-muted">How'd it go?</p>
        <div
          key={s.climbingType}
          className={`grid gap-2 ${
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
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3.5 text-center transition ${
                  on
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-surface-2 text-muted hover:text-chalk"
                }`}
              >
                <Icon size={22} />
                <span className="text-sm font-bold leading-none">{label}</span>
                <span className="whitespace-nowrap text-[10px] leading-none text-faint">
                  {hint}
                </span>
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
          ref={s.photoRef}
          type="file"
          accept="image/*"
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
              <ImagePlus size={32} />
              <span className="text-sm">Tap to add a photo</span>
            </span>
          )}
        </button>
        {s.photoPreview ? (
          <button
            type="button"
            onClick={() => s.photoRef.current?.click()}
            className="mt-2 flex items-center gap-1 text-sm text-accent"
          >
            <Camera size={15} /> Change photo
          </button>
        ) : null}
      </div>

      {/* The climb */}
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        <Row label="Hold color">
          <Dropdown
            value={s.holdColor ?? "Choose"}
            options={HOLD_COLORS.map((c) => c.name)}
            onChange={s.setHoldColor}
            align="right"
          />
        </Row>
        {s.holdColor ? (
          <div className="flex items-center gap-2 text-xs text-faint">
            <span
              className="h-3 w-3 rounded-full border border-white/10"
              style={{ backgroundColor: holdHex(s.holdColor) }}
            />
            {s.holdColor} holds
          </div>
        ) : null}
        <Row label="Wall section">
          <Dropdown
            value={s.section || "Choose"}
            options={[...WALL_SECTIONS, OTHER]}
            onChange={s.setSection}
            align="right"
          />
        </Row>
        {s.section === OTHER ? (
          <Input
            value={s.customSection}
            onChange={(e) => s.setCustomSection(e.target.value)}
            placeholder="Name the section"
          />
        ) : null}
        <Row label="Gym's grade">
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
            align="right"
          />
        </Row>
      </div>

      {/* Your take */}
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Felt grade
            <span className="ml-1 font-normal normal-case text-faint">(optional)</span>
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
          <Stars value={s.stars} onChange={s.setStars} size={22} />
        </div>
      </div>

      {/* Note — becomes the project's first journal entry for projects */}
      <Textarea
        label={s.outcome === "project" ? "Project notes (optional)" : "Note (optional)"}
        value={s.note}
        onChange={(e) => s.setNote(e.target.value)}
        placeholder={
          s.outcome === "project"
            ? "Beta, what's not working, what to try next…"
            : "How'd it feel?"
        }
        maxLength={500}
      />

      <ErrorText>{s.error}</ErrorText>
      <Button loading={s.busy} onClick={s.save} className="w-full">
        {s.outcome === "project" ? "Save project" : "Log it"}
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-chalk">{label}</span>
      {children}
    </div>
  );
}

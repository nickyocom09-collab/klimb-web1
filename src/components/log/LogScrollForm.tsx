import { Camera, CheckCircle2, Eye, EyeOff, ImagePlus, Video } from "lucide-react";
import { HOLD_COLORS, holdHex } from "../../lib/constants";
import { NOT_SET, type LogClimbState } from "../../lib/useLogClimb";
import { Button, ErrorText, Input, Textarea } from "../ui";
import { Dropdown } from "../Dropdown";
import { GradePicker } from "../GradePicker";
import { Stars } from "../Stars";
import { ClimbTypePicker } from "./ClimbTypePicker";
import { OUTCOME_ICON } from "./outcomeIcon";
import { IMAGE_ACCEPT } from "../../lib/uploadSecurity";
import { ProBadge } from "../ProBadge";

/** The original one-screen log form: every field on a single scroll. */
export function LogScrollForm({ s }: { s: LogClimbState }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Boulder or rope? First choice — it drives the outcomes and grades. */}
      <div>
        <p className="mb-2 ml-1 text-sm text-muted">Type of climb</p>
        <ClimbTypePicker value={s.climbingType} onChange={s.changeType} />
      </div>

      {/* How'd it go? The heart of the log. */}
      <div>
        <p className="mb-2 ml-1 text-sm text-muted">How'd it go?</p>
        <div
          key={s.climbingType}
          className="grid grid-cols-3 gap-2"
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

      {!s.offGrid && s.logbookPreferences.show_video ? (
        <div>
          <p className="mb-2 ml-1 flex items-center gap-2 text-sm text-muted">
            Video <span className="text-faint">(optional)</span> <ProBadge compact />
          </p>
          {s.hasProAccess ? (
            <>
              <input
                ref={s.videoRef}
                type="file"
                accept="video/*"
                onChange={(event) => void s.onPickVideo(event)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => void s.pickVideo()}
                className={`flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-3xl border transition active:scale-[0.99] ${s.video ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface-2 text-faint"}`}
              >
                {s.video ? <CheckCircle2 size={31} /> : <Video size={31} />}
                <span className="max-w-[17rem] truncate text-sm font-bold">{s.video?.name ?? "Choose a video under three minutes"}</span>
              </button>
            </>
          ) : (
            <button type="button" onClick={() => s.navigate({ search: "?pro=video" })} className="flex w-full flex-col items-center rounded-3xl border border-accent/25 bg-accent/[0.06] px-6 py-6 text-center active:scale-[0.99]">
              <Video size={29} className="text-accent" />
              <span className="mt-2 font-extrabold text-chalk">Add video with Klimb Pro</span>
              <span className="mt-1 text-xs text-muted">Attach it here and find it later in your video library.</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Photo */}
      {s.logbookPreferences.show_photo ? <div>
        <p className="mb-2 ml-1 text-sm text-muted">
          Photo <span className="text-faint">(optional)</span>
        </p>
        <input
          ref={s.photoRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={s.onPickPhoto}
          className="hidden"
        />
        <button
          type="button"
          onClick={s.pickPhoto}
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
            onClick={s.pickPhoto}
            className="mt-2 flex items-center gap-1 text-sm text-accent"
          >
            <Camera size={15} /> Change photo
          </button>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-faint">
          Route photos can appear with the shared gym route. Don&apos;t include
          private information you would not want other climbers to see.
        </p>
      </div> : null}

      {/* The climb */}
      {s.logbookPreferences.show_hold_color || s.logbookPreferences.show_gym_grade || (s.routeNamesEnabled && s.logbookPreferences.show_route_name) ? (
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        {s.logbookPreferences.show_hold_color ? <Row label="Hold color">
          <Dropdown
            value={s.holdColor ?? "Choose"}
            options={HOLD_COLORS.map((c) => c.name)}
            onChange={s.setHoldColor}
            align="right"
          />
        </Row> : null}
        {s.logbookPreferences.show_hold_color && s.holdColor ? (
          <div className="flex items-center gap-2 text-xs text-faint">
            <span
              className={`h-3 w-3 rounded-full ${s.holdColor === "White" ? "border border-black/15" : ""}`}
              style={{ backgroundColor: holdHex(s.holdColor) }}
            />
            {s.holdColor} holds
          </div>
        ) : null}
        {s.routeNamesEnabled && s.logbookPreferences.show_route_name ? (
          <Input
            label="Route name (optional)"
            value={s.routeName}
            onChange={(event) => s.setRouteName(event.target.value)}
            placeholder="e.g. The Green Mile"
            maxLength={80}
          />
        ) : null}
        {s.logbookPreferences.show_gym_grade ? <Row label="Gym's grade">
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
        </Row> : null}
      </div>
      ) : null}

      {/* Your take */}
      {s.logbookPreferences.show_felt_grade || s.logbookPreferences.show_quality ? (
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-card">
        {s.logbookPreferences.show_felt_grade ? <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-faint">
            Felt grade
            <span className="ml-1 font-normal normal-case text-faint">(optional)</span>
          </p>
          <GradePicker
            value={s.feltGrade}
            onChange={s.setFeltGrade}
            climbingType={s.climbingType}
            system={s.system}
            emptyLabel="Not sure"
          />
        </div> : null}
        {s.logbookPreferences.show_quality ? <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-faint">Quality</p>
          <Stars value={s.stars} onChange={s.setStars} size={22} />
        </div> : null}
      </div>
      ) : null}

      {/* Note — becomes the project's first journal entry for projects */}
      {s.logbookPreferences.show_note ? <Textarea
        label={s.outcome === "project" ? "Project notes (optional)" : "Note (optional)"}
        value={s.note}
        onChange={(e) => s.setNote(e.target.value)}
        placeholder={
          s.outcome === "project"
            ? "Beta, what's not working, what to try next…"
            : "How'd it feel?"
        }
        maxLength={500}
      /> : null}

      {/* Profile visibility is deliberately the final decision. Saving a
          Klimb and posting it are separate actions. */}
      {s.logbookPreferences.show_profile_visibility ? <div className="rounded-3xl border border-border bg-surface p-4 shadow-card">
        <p className="text-sm font-bold text-chalk">Post this to your profile?</p>
        <p className="mt-1 text-xs leading-relaxed text-faint">
          It stays in your personal logbook, stats, and recap either way.
          This controls your profile and friends feed; a route photo may still
          appear with the shared gym route.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => s.setShareToProfile(true)}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition ${
              s.shareToProfile
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-2 text-muted"
            }`}
          >
            <Eye size={17} /> Post it
          </button>
          <button
            type="button"
            onClick={() => s.setShareToProfile(false)}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition ${
              !s.shareToProfile
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface-2 text-muted"
            }`}
          >
            <EyeOff size={17} /> Just for me
          </button>
        </div>
      </div> : null}

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

import { useEffect, useId, useRef, useState } from "react";
import {
  CONTENT_REPORT_REASONS,
  type ContentReason,
} from "../lib/constants";
import { reportContent, type ReportTargetType } from "../lib/moderation";
import { Button } from "./ui";

export function ContentReportSheet({
  open,
  targetType,
  targetId,
  title,
  onClose,
  onSent,
  submitReport,
}: {
  open: boolean;
  targetType: ReportTargetType;
  targetId: string;
  title: string;
  onClose: () => void;
  onSent: (message: string) => void;
  submitReport?: (
    reason: ContentReason,
    note?: string,
  ) => Promise<{ error: string | null }>;
}) {
  const [reason, setReason] = useState<ContentReason>("inappropriate");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  const noteId = useId();

  useEffect(() => {
    busyRef.current = busy;
    onCloseRef.current = onClose;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) onCloseRef.current();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    const result = submitReport
      ? await submitReport(reason, note.trim() || undefined)
      : await reportContent(
          targetType,
          targetId,
          reason,
          note.trim() || undefined,
        );
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNote("");
    onClose();
    onSent("Report sent. Thanks for helping keep Klimb safe.");
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="w-full animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId} className="text-lg font-bold text-chalk">{title}</h2>
        <p id={descriptionId} className="mt-1 text-sm text-muted">
          Tell us what is wrong. Reports are private and reviewed for safety.
        </p>
        <div className="mt-4 grid gap-2">
          {CONTENT_REPORT_REASONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-chalk"
            >
              <input
                type="radio"
                name={`report-${targetType}-${targetId}`}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="accent-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
        <label htmlFor={noteId} className="sr-only">
          Additional report details
        </label>
        <textarea
          id={noteId}
          name="report-details"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Add details (optional)"
          className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-chalk placeholder:text-faint outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/45"
        />
        {error ? <p className="mt-2 text-sm text-wide" role="alert">{error}</p> : null}
        <div className="mt-4 grid gap-2">
          <Button variant="danger" className="w-full" loading={busy} onClick={submit}>
            Send private report
          </Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </section>
    </div>
  );
}

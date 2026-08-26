import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "h-12 rounded-2xl inline-flex touch-manipulation items-center justify-center px-5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 select-none";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-accent text-bg font-bold hover:bg-accent-dim",
    secondary: "bg-surface-2 text-chalk border border-border hover:border-faint",
    ghost: "bg-transparent text-muted hover:text-chalk",
    danger: "bg-transparent text-wide border border-wide/60 hover:bg-wide/10",
  };
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-2 ml-1 block text-sm text-muted">{label}</span>
      ) : null}
      <input
        className={`h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-chalk placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
        {...props}
      />
    </label>
  );
}

/** Password field with a show/hide eye toggle. */
export function PasswordInput({
  label,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-2 ml-1 block text-sm text-muted">{label}</span>
      ) : null}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 pr-12 text-chalk placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full text-faint transition hover:text-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {show ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
    </label>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-2 ml-1 block text-sm text-muted">{label}</span>
      ) : null}
      <textarea
        className={`min-h-[88px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-chalk placeholder:text-faint outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Segmented control with a sliding pill. The active background is a single
 * element that glides between segments instead of jumping.
 */
export function SlideTabs<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="tablist"
      className={`relative flex rounded-full bg-surface-2 p-1 ${className}`}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-full bg-accent shadow-lg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex-1 touch-manipulation rounded-full py-2 text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
            o.value === value ? "text-bg" : "text-muted hover:text-chalk"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" aria-live="polite" className="ml-1 text-sm text-wide">
      {children}
    </p>
  );
}

export function CenterSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner className="text-accent" />
    </div>
  );
}

/** Shimmering placeholder block — compose these into layout-shaped loaders. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-shimmer rounded-2xl bg-gradient-to-r from-surface via-surface-2 to-surface bg-[length:200%_100%] ${className}`}
    />
  );
}

/** Layout-shaped loading state for card/list screens (Logbook, Gym, Stats). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-2">
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

/**
 * A bottom-sheet yes/no confirmation. Render it with `open` controlled by the
 * caller; it handles the scrim, its own dismissal on tap-out/Cancel, and calls
 * `onConfirm` for the primary action.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel, open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 mx-auto flex max-w-app animate-fade-in items-end bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        tabIndex={-1}
        className="w-full overscroll-contain animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-bold text-chalk">{title}</h3>
        {message ? (
          <p id={messageId} className="mt-1 text-sm text-muted">{message}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2">
          <Button variant={variant} className="w-full" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

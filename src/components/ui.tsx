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
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "h-12 rounded-2xl inline-flex items-center justify-center px-5 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 select-none";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-accent text-bg font-bold hover:bg-accent-dim",
    secondary: "bg-surface-2 text-chalk border border-border hover:border-faint",
    ghost: "bg-transparent text-muted hover:text-chalk",
    danger: "bg-transparent text-wide border border-wide/60 hover:bg-wide/10",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
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
        className={`h-12 w-full rounded-2xl border border-border bg-surface-2 px-4 text-chalk placeholder:text-faint outline-none focus:border-accent ${className}`}
        {...props}
      />
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
        className={`min-h-[88px] w-full rounded-2xl border border-border bg-surface-2 px-4 py-3 text-chalk placeholder:text-faint outline-none focus:border-accent ${className}`}
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

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="ml-1 text-sm text-wide">{children}</p>;
}

export function CenterSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner className="text-accent" />
    </div>
  );
}

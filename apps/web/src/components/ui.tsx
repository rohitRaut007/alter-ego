import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  className,
  loading,
  variant = "primary",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    outline: "border border-border-strong bg-card text-foreground hover:bg-surface",
    ghost: "text-muted-foreground hover:bg-surface hover:text-foreground",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
        styles,
        className ?? "w-full",
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function Field({
  label,
  error,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("rise-in rounded-xl border border-border bg-card p-6 shadow-soft", className)}
    >
      {children}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-1 w-full overflow-hidden rounded-full bg-secondary"
    >
      <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center py-16 text-sm text-muted-foreground"
    >
      {label}…
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

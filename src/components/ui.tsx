import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Clean, accessible, modern UI building blocks. */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong shadow-sm hover:shadow active:scale-[0.99] border border-transparent",
  secondary: "bg-surface text-ink border border-line hover:border-brand/60 shadow-xs hover:shadow-sm active:scale-[0.99]",
  ghost: "bg-transparent text-ink hover:bg-surface-2 border border-transparent active:scale-[0.99]",
  danger: "bg-danger-bg text-danger border border-danger/30 hover:bg-danger-bg/80 active:scale-[0.99]",
  success: "bg-ok-bg text-ok border border-ok/30 hover:bg-ok-bg/80 active:scale-[0.99]",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm rounded-xl font-medium",
  md: "min-h-12 px-4 text-base rounded-xl font-semibold",
  lg: "min-h-14 px-5 text-lg rounded-2xl font-bold",
  xl: "min-h-16 px-6 text-xl sm:text-2xl rounded-2xl font-extrabold tracking-wide",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2.5 select-none transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx(
        "rounded-3xl border border-line/80 bg-surface p-5 sm:p-6 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.04)] dark:shadow-none transition-all",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-base sm:text-lg text-muted font-medium">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

const inputClass =
  "mt-1.5 block w-full min-h-12 rounded-xl border border-line bg-surface px-4 text-lg text-ink placeholder:text-muted/60 transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; id: string }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClass} {...props} />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
  hint,
  error,
  ...props
}: ComponentProps<"select"> & { label: string; id: string; hint?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      <select id={id} className={cx(inputClass, "pr-8 cursor-pointer")} {...props}>
        {children}
      </select>
      {error ? <p className="mt-1 text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: ComponentProps<"textarea"> & { label: string; hint?: string; error?: string; id: string }) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(inputClass, "min-h-24 py-3 resize-y")}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Badge({ tone = "info", children }: { tone?: "ok" | "warn" | "danger" | "info"; children: ReactNode }) {
  const styles = {
    ok: "bg-ok-bg text-ok border-ok/30",
    warn: "bg-warn-bg text-warn border-warn/30",
    danger: "bg-danger-bg text-danger border-danger/30",
    info: "bg-surface-2 text-ink border-line",
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold tracking-wide", styles)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "ok" | "warn" | "danger" | "info";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    ok: "border-ok/40 bg-ok-bg/70 text-ink",
    warn: "border-warn/40 bg-warn-bg/70 text-ink",
    danger: "border-danger/40 bg-danger-bg/70 text-ink",
    info: "border-brand/30 bg-surface-2 text-ink",
  }[tone];

  const icons = {
    ok: "✓",
    warn: "⚠️",
    danger: "✕",
    info: "ℹ️",
  }[tone];

  return (
    <div role="status" className={cx("rounded-2xl border p-4.5 shadow-xs transition-all", styles)}>
      <div className="flex gap-3">
        <span className="text-xl shrink-0 select-none" aria-hidden="true">
          {icons}
        </span>
        <div className="space-y-1">
          {title ? <p className="font-bold text-base leading-snug">{title}</p> : null}
          <div className="text-base leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" role="status">
      <div className="h-6 w-6 animate-spin rounded-full border-3 border-line border-t-brand" />
      <span className="text-base font-semibold text-muted">{label}</span>
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center p-8">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line bg-surface/50 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-2xl shadow-xs">
        📦
      </div>
      <h3 className="mt-4 text-xl font-bold text-ink">{title}</h3>
      {children ? <p className="mt-2 text-base text-muted max-w-sm mx-auto">{children}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-danger/30 bg-danger-bg/50 p-8 text-center" role="alert">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-2xl text-danger">
        ⚠️
      </div>
      <h2 className="mt-4 text-xl font-bold text-ink">We could not load this screen</h2>
      <p className="mt-2 text-base text-danger font-medium">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="md" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Disclaimer() {
  return (
    <aside className="rounded-2xl border border-line bg-surface-2/60 p-4 text-sm text-muted">
      <strong>Medical disclaimer:</strong> VridhaSuraksha supports daily care routines. It does not provide medical
      advice, diagnose conditions, or replace guidance from a doctor or pharmacist.
    </aside>
  );
}

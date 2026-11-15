import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small, accessible building blocks shared by every screen. */

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong border border-transparent",
  secondary: "bg-surface text-ink border-2 border-line hover:border-brand",
  ghost: "bg-transparent text-ink hover:bg-surface-2 border border-transparent",
  danger: "bg-danger-bg text-danger border-2 border-danger hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-5 text-lg",
  xl: "min-h-20 px-6 text-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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
  return <section className={cx("rounded-3xl border border-line bg-surface p-5 shadow-sm", className)} {...props} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-lg text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

const inputClass =
  "mt-1 block w-full min-h-12 rounded-xl border-2 border-line bg-surface px-3 text-lg text-ink placeholder:text-muted focus:border-brand";

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
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
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
  ...props
}: ComponentProps<"select"> & { label: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <select id={id} className={inputClass} {...props}>
        {children}
      </select>
    </div>
  );
}

export function TextArea({ label, id, ...props }: ComponentProps<"textarea"> & { label: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <textarea id={id} className={cx(inputClass, "min-h-24 py-2")} {...props} />
    </div>
  );
}

type Tone = "ok" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok border-ok",
  warn: "bg-warn-bg text-warn border-warn",
  danger: "bg-danger-bg text-danger border-danger",
  info: "bg-surface-2 text-ink border-line",
};

const ICONS: Record<Tone, string> = { ok: "✓", warn: "!", danger: "✕", info: "i" };

/** Status text always carries an icon and words, never colour alone. */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold", TONES[tone])}>
      <span aria-hidden="true">{ICONS[tone]}</span>
      {children}
    </span>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-2xl border-2 p-4", TONES[tone])}>
      {title ? <p className="font-bold">{title}</p> : null}
      {children ? <div className="text-base">{children}</div> : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      <span>{label}…</span>
    </span>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line p-8 text-center">
      <p className="text-xl font-semibold">{title}</p>
      {children ? <div className="mt-2 text-muted">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice tone="danger" title="Something went wrong">
      <p>{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </Notice>
  );
}

export function Disclaimer() {
  return (
    <p className="text-sm text-muted">
      VridhaSuraksha supports daily routines. It does not replace advice from a doctor or pharmacist.
    </p>
  );
}

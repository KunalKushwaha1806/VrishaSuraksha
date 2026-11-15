"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import type { Role } from "@/lib/models";
import { cx } from "./ui";

const LINKS: Record<Role, Array<{ href: string; label: string; icon?: string }>> = {
  ELDER: [
    { href: "/app/elder", label: "Home", icon: "🏠" },
    { href: "/app/medicines", label: "Medicines", icon: "💊" },
    { href: "/app/appointments", label: "Doctor visits", icon: "🩺" },
    { href: "/app/members", label: "Who can see what", icon: "🔒" },
    { href: "/app/emergency", label: "Emergency card", icon: "🚨" },
    { href: "/app/activity", label: "Activity", icon: "📜" },
    { href: "/app/settings", label: "Settings", icon: "⚙️" },
  ],
  CARETAKER: [
    { href: "/app/care", label: "Dashboard", icon: "📊" },
    { href: "/app/medicines", label: "Medicines", icon: "💊" },
    { href: "/app/scan", label: "Scan prescription", icon: "📷" },
    { href: "/app/appointments", label: "Doctor visits", icon: "🩺" },
    { href: "/app/brief", label: "Doctor brief", icon: "📋" },
    { href: "/app/members", label: "Circle", icon: "👥" },
    { href: "/app/settings", label: "Settings", icon: "⚙️" },
  ],
  FAMILY: [
    { href: "/app/family", label: "Home", icon: "❤️" },
    { href: "/app/medicines", label: "Medicines", icon: "💊" },
    { href: "/app/appointments", label: "Doctor visits", icon: "🩺" },
    { href: "/app/members", label: "Circle", icon: "👥" },
    { href: "/app/settings", label: "Settings", icon: "⚙️" },
  ],
};

const ROLE_BADGE: Record<Role, { label: string; icon: string; style: string }> = {
  ELDER: { label: "Dadaji / Elder", icon: "👴", style: "bg-amber-100/90 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200" },
  CARETAKER: { label: "Caretaker", icon: "👩‍⚕️", style: "bg-blue-100/90 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200" },
  FAMILY: { label: "Family", icon: "👨‍👩‍👦", style: "bg-rose-100/90 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200" },
};

export function AppNav({ role, name, circleName, isDemo }: { role: Role; name: string; circleName: string; isDemo: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { body: {} }).catch(() => undefined);
    window.location.assign(isDemo ? "/demo" : "/");
  }

  const roleInfo = ROLE_BADGE[role];

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/60 bg-surface/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/app" className="flex items-center gap-2 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl text-white shadow-xs group-hover:scale-105 transition-transform">
              🛡️
            </span>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-ink group-hover:text-brand transition-colors">
                VridhaSuraksha
              </span>
              <p className="text-xs font-medium text-muted">
                {name} · {circleName}
              </p>
            </div>
          </Link>

          <span className={cx("hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold", roleInfo.style)}>
            <span aria-hidden="true">{roleInfo.icon}</span> {roleInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isDemo ? (
            <Link
              href="/demo"
              className="inline-flex items-center gap-1 rounded-xl bg-surface-2 border border-line px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/60 transition shadow-2xs"
            >
              🔄 <span className="hidden sm:inline">Switch Persona</span>
            </Link>
          ) : null}

          <button
            type="button"
            className="flex h-10 items-center justify-center rounded-xl border border-line bg-surface px-3 font-semibold sm:hidden hover:bg-surface-2 transition text-sm"
            aria-expanded={open}
            aria-controls="app-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕ Close" : "☰ Menu"}
          </button>
        </div>

        <nav id="app-nav" aria-label="Main" className={cx("w-full sm:block sm:w-auto", open ? "block pt-2" : "hidden")}>
          <ul className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-1.5">
            {LINKS[role].map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all",
                      active
                        ? "bg-brand text-brand-ink shadow-xs"
                        : "text-ink/80 hover:text-ink hover:bg-surface-2",
                    )}
                  >
                    {l.icon ? <span className="text-sm opacity-80" aria-hidden="true">{l.icon}</span> : null}
                    {l.label}
                  </Link>
                </li>
              );
            })}
            <li className="pt-1 sm:pt-0 sm:ml-1">
              <button
                type="button"
                onClick={logout}
                className="flex min-h-10 w-full sm:w-auto items-center justify-center rounded-xl border border-transparent px-3 py-1.5 text-sm font-semibold text-muted hover:bg-danger-bg hover:text-danger hover:border-danger/20 transition-all"
              >
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

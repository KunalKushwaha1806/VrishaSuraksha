"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import type { Role } from "@/lib/models";
import { cx } from "./ui";

const LINKS: Record<Role, Array<{ href: string; label: string }>> = {
  ELDER: [
    { href: "/app/elder", label: "Home" },
    { href: "/app/medicines", label: "Medicines" },
    { href: "/app/appointments", label: "Doctor visits" },
    { href: "/app/members", label: "Who can see what" },
    { href: "/app/emergency", label: "Emergency card" },
    { href: "/app/activity", label: "Activity" },
    { href: "/app/settings", label: "Settings" },
  ],
  CARETAKER: [
    { href: "/app/care", label: "Dashboard" },
    { href: "/app/medicines", label: "Medicines" },
    { href: "/app/scan", label: "Scan prescription" },
    { href: "/app/appointments", label: "Doctor visits" },
    { href: "/app/brief", label: "Doctor brief" },
    { href: "/app/members", label: "Circle" },
    { href: "/app/settings", label: "Settings" },
  ],
  FAMILY: [
    { href: "/app/family", label: "Home" },
    { href: "/app/medicines", label: "Medicines" },
    { href: "/app/appointments", label: "Doctor visits" },
    { href: "/app/members", label: "Circle" },
    { href: "/app/settings", label: "Settings" },
  ],
};

const ROLE_LABEL: Record<Role, string> = { ELDER: "Elder", CARETAKER: "Caretaker", FAMILY: "Family" };

export function AppNav({ role, name, circleName, isDemo }: { role: Role; name: string; circleName: string; isDemo: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { body: {} }).catch(() => undefined);
    router.push(isDemo ? "/demo" : "/");
    router.refresh();
  }

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <Link href="/app" className="text-xl font-bold text-brand">
            VridhaSuraksha
          </Link>
          <p className="text-sm text-muted">
            {circleName} · {name} ({ROLE_LABEL[role]}){isDemo ? " · Demo" : ""}
          </p>
        </div>
        <button
          type="button"
          className="min-h-12 rounded-xl border-2 border-line px-4 font-semibold sm:hidden"
          aria-expanded={open}
          aria-controls="app-nav"
          onClick={() => setOpen((v) => !v)}
        >
          Menu
        </button>
        <nav id="app-nav" aria-label="Main" className={cx("w-full sm:block", open ? "block" : "hidden")}>
          <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
            {LINKS[role].map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "flex min-h-12 items-center rounded-xl px-3 font-semibold",
                      active ? "bg-brand text-brand-ink" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button type="button" onClick={logout} className="flex min-h-12 items-center rounded-xl px-3 font-semibold text-muted hover:bg-surface-2">
                Sign out
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

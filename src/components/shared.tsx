"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import type { DoseStatus, MissedReason } from "@/lib/models";
import { Badge, Button } from "./ui";

export const REASON_LABEL: Record<MissedReason, string> = {
  forgot: "Forgot",
  unwell: "Felt unwell",
  side_effect: "Side effect",
  ran_out: "Ran out",
};

export function DoseStatusBadge({ status, reason }: { status: DoseStatus; reason?: MissedReason | null }) {
  if (status === "TAKEN") return <Badge tone="ok">Taken</Badge>;
  if (status === "SKIPPED") return <Badge tone="info">Skipped</Badge>;
  if (status === "MISSED") return <Badge tone="warn">Missed{reason ? `: ${REASON_LABEL[reason]}` : ""}</Badge>;
  return <Badge tone="info">Due</Badge>;
}

/** Percentage shown as text and a bar; the number is always present so colour is never the only signal. */
export function PercentBar({ label, percent }: { label: string; percent: number | null }) {
  const value = percent ?? 0;
  return (
    <div>
      <div className="flex justify-between text-base">
        <span className="font-semibold">{label}</span>
        <span>{percent === null ? "No doses yet" : `${percent}%`}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? "No doses yet" : `${percent} percent`}
        className="mt-1 h-3 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/** "I'll handle it": first claimer wins, everyone else sees the refill is covered. */
export function ClaimRefillButton({
  medicationId,
  claimedByName,
  onDone,
}: {
  medicationId: string;
  claimedByName: string | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (claimedByName) return <Badge tone="ok">{claimedByName} is handling it</Badge>;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="md"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/refills/${encodeURIComponent(medicationId)}/claim`, { body: {} });
            onDone();
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        I&apos;ll handle it
      </Button>
      {error ? <span role="alert" className="text-sm text-danger">{error}</span> : null}
    </span>
  );
}

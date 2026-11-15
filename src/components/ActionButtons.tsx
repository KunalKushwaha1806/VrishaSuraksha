"use client";

import { useState } from "react";
import { api, errorText } from "@/lib/client/api";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/models";
import { Button, LinkButton, Notice } from "./ui";

type Choice = "taken" | "forgot" | "unwell" | "side_effect" | "ran_out" | "claim";

export function ActionButtons({
  token,
  kind,
  lang,
  onBehalf = false,
}: {
  token: string;
  kind: "dose" | "refill";
  lang: Lang;
  onBehalf?: boolean;
}) {
  const d = t(lang);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasons, setShowReasons] = useState(false);

  async function act(choice: Choice) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/action", { body: { token, choice } });
      setDone(choice === "claim" ? "Thank you! Everyone can see you are handling it." : d.logged);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Notice tone="ok">{done}</Notice>
        <LinkButton href="/app" variant="secondary" size="lg">
          Open VridhaSuraksha
        </LinkButton>
      </div>
    );
  }

  return (
    <div lang={lang} className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {kind === "refill" ? (
        <Button size="xl" className="w-full" onClick={() => act("claim")} disabled={busy}>
          I&apos;ll handle it
        </Button>
      ) : showReasons ? (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-2xl font-semibold">{d.whyMissed}</legend>
          {(
            [
              ["forgot", d.reasonForgot],
              ["unwell", d.reasonUnwell],
              ["side_effect", d.reasonSideEffect],
              ["ran_out", d.reasonRanOut],
            ] as const
          ).map(([key, label]) => (
            <Button key={key} size="xl" variant="secondary" className="w-full" onClick={() => act(key)} disabled={busy}>
              {label}
            </Button>
          ))}
        </fieldset>
      ) : (
        <>
          {onBehalf ? (
            <p className="text-muted">You are logging this on the elder&apos;s behalf. It will be recorded.</p>
          ) : null}
          <Button size="xl" className="w-full" onClick={() => act("taken")} disabled={busy}>
            ✅ {d.tookIt}
          </Button>
          <Button size="xl" variant="secondary" className="w-full" onClick={() => setShowReasons(true)} disabled={busy}>
            {d.notNow}
          </Button>
        </>
      )}
    </div>
  );
}

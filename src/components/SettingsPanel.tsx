"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorText } from "@/lib/client/api";
import type { Lang } from "@/lib/models";
import { Button, Card, Field, Notice, PageHeader, SelectField } from "./ui";

export function SettingsPanel({
  language,
  isElder,
  circleName,
}: {
  language: Lang;
  isElder: boolean;
  circleName: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [confirm, setConfirm] = useState("");

  async function saveLanguage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api("/api/me", { method: "PATCH", body: { language: new FormData(e.currentTarget).get("language") } });
      setMsg({ tone: "ok", text: "Language saved." });
      router.refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: errorText(err) });
    }
  }

  async function deleteAll(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm("This permanently deletes the whole circle for everyone. Continue?")) return;
    try {
      await api("/api/circle", { method: "DELETE", body: { confirm } });
      router.push("/");
      router.refresh();
    } catch (err) {
      setMsg({ tone: "danger", text: errorText(err) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        <form onSubmit={saveLanguage} className="flex flex-wrap items-end gap-3">
          <SelectField id="language" name="language" label="Language for screens and reminders" defaultValue={language}>
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </SelectField>
          <Button type="submit">Save</Button>
        </form>
      </Card>
      {isElder ? (
        <>
          <Card>
            <h2 className="text-2xl font-bold">Your data</h2>
            <p className="mt-1 text-muted">
              Download everything this circle holds about you, including notes, as a file.
            </p>
            <a
              href="/api/export"
              className="mt-3 inline-flex min-h-12 items-center rounded-2xl bg-brand px-4 font-semibold text-brand-ink"
            >
              Download my data
            </a>
          </Card>
          <Card className="border-danger">
            <h2 className="text-2xl font-bold text-danger">Delete everything</h2>
            <p className="mt-1 text-muted">
              Removes the circle, all members, medicines, logs, voice notes and pending reminders. This cannot be
              undone.
            </p>
            <form onSubmit={deleteAll} className="mt-3 space-y-3">
              <Field
                id="confirm"
                label={`Type “${circleName}” to confirm`}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" variant="danger" disabled={confirm !== circleName}>
                Delete my circle and data
              </Button>
            </form>
          </Card>
        </>
      ) : null}
    </div>
  );
}

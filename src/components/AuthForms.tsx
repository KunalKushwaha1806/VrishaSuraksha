"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorText, fieldErrors } from "@/lib/client/api";
import { Button, Field, Notice, SelectField } from "./ui";

function useSubmit(path: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function submit(e: FormEvent<HTMLFormElement>, transform?: (data: Record<string, string>) => unknown) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await api<{ circleCode?: string }>(path, { body: transform ? transform(data) : data });
      window.location.assign(res.circleCode ? `/app?welcome=${encodeURIComponent(res.circleCode)}` : "/app");
    } catch (err) {
      setError(errorText(err));
      setFields(fieldErrors(err));
      setBusy(false);
    }
  }
  return { busy, error, fields, submit };
}

function LanguageSelect() {
  return (
    <SelectField id="language" name="language" label="Language for reminders" defaultValue="en">
      <option value="en">English</option>
      <option value="hi">हिन्दी (Hindi)</option>
    </SelectField>
  );
}

export function CreateCircleForm() {
  const { busy, error, fields, submit } = useSubmit("/api/auth/create");
  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4" noValidate>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field
        id="elderName"
        name="elderName"
        label="Elder's name"
        autoComplete="name"
        required
        error={fields.elderName}
      />
      <Field
        id="circleName"
        name="circleName"
        label="Circle name"
        placeholder="e.g. Sharma family"
        required
        error={fields.circleName}
      />
      <Field
        id="email"
        name="email"
        type="email"
        label="Elder's email (for reminders)"
        autoComplete="email"
        required
        error={fields.email}
      />
      <Field
        id="passcode"
        name="passcode"
        type="password"
        label="Choose a passcode"
        hint="At least 6 characters. A 6-digit number is fine."
        autoComplete="new-password"
        inputMode="text"
        required
        error={fields.passcode}
      />
      <LanguageSelect />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create care circle"}
      </Button>
    </form>
  );
}

export function JoinCircleForm() {
  const { busy, error, fields, submit } = useSubmit("/api/auth/join");
  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4" noValidate>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field
        id="circleCode"
        name="circleCode"
        label="Circle code"
        placeholder="6 letters or numbers"
        autoCapitalize="characters"
        required
        error={fields.circleCode}
      />
      <Field
        id="inviteCode"
        name="inviteCode"
        label="Invite passcode"
        hint="The one-time code the elder or caretaker gave you."
        autoCapitalize="characters"
        required
        error={fields.inviteCode}
      />
      <Field id="name" name="name" label="Your name" autoComplete="name" required error={fields.name} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Your email"
        autoComplete="email"
        required
        error={fields.email}
      />
      <Field
        id="passcode"
        name="passcode"
        type="password"
        label="Choose your own passcode"
        hint="At least 6 characters."
        autoComplete="new-password"
        required
        error={fields.passcode}
      />
      <LanguageSelect />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Joining…" : "Join circle"}
      </Button>
    </form>
  );
}

export function LoginForm() {
  const { busy, error, fields, submit } = useSubmit("/api/auth/login");
  const expired = useSearchParams().get("expired");
  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4" noValidate>
      {expired && !error ? <Notice tone="info">Your session ended. Please sign in again.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field
        id="circleCode"
        name="circleCode"
        label="Circle code"
        autoCapitalize="characters"
        required
        error={fields.circleCode}
      />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required error={fields.email} />
      <Field
        id="passcode"
        name="passcode"
        type="password"
        label="Passcode"
        autoComplete="current-password"
        required
        error={fields.passcode}
      />
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-muted">
        New here?{" "}
        <Link href="/join" className="font-semibold text-brand underline">
          Join with an invite
        </Link>
      </p>
    </form>
  );
}

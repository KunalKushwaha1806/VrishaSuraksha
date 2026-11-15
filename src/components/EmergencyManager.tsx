"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorText } from "@/lib/client/api";
import type { EmergencyContact } from "@/lib/models";
import { formatDateTime } from "@/lib/time";
import { Badge, Button, Card, Field, Notice, PageHeader, SelectField } from "./ui";

interface LinkView {
  id: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}

export function EmergencyManager({ initialContacts }: { initialContacts: EmergencyContact[] }) {
  const [links, setLinks] = useState<LinkView[]>([]);
  const [created, setCreated] = useState<{ url: string; qrDataUrl: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialContacts);
  const [savedContacts, setSavedContacts] = useState(false);

  const load = useCallback(async () => {
    try {
      setLinks((await api<{ links: LinkView[] }>("/api/share")).links);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const hours = Number(new FormData(e.currentTarget).get("hours"));
    setError(null);
    try {
      setCreated(await api("/api/share", { body: { hours } }));
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/share/${encodeURIComponent(id)}`, { method: "DELETE" });
      setCreated(null);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function saveContacts(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/circle", { method: "PATCH", body: { emergencyContacts: contacts.filter((c) => c.name && c.phone) } });
      setSavedContacts(true);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency card"
        subtitle="A QR code that opens a read-only page with your medicines, doctor and emergency contacts. It expires, and you can switch it off any time."
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card>
        <h2 className="text-2xl font-bold">Create a card</h2>
        <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-3">
          <SelectField id="hours" name="hours" label="Valid for" defaultValue="72">
            <option value="24">1 day</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </SelectField>
          <Button type="submit" size="lg">
            Create QR card
          </Button>
        </form>
        {created ? (
          <div className="mt-5 flex flex-wrap items-center gap-6 rounded-2xl bg-surface-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL generated on the server */}
            <img src={created.qrDataUrl} alt="QR code for the emergency card" width={200} height={200} className="rounded-xl bg-white p-2" />
            <div className="space-y-2">
              <p className="font-semibold">Valid until {formatDateTime(created.expiresAt)}</p>
              <p className="break-all text-sm text-muted">{created.url}</p>
              <Button variant="secondary" onClick={() => window.print()}>
                Print card
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">Your cards</h2>
        {links.length === 0 ? (
          <p className="mt-2 text-muted">No cards yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  Created {formatDateTime(l.createdAt)} · expires {formatDateTime(l.expiresAt)}
                </span>
                {l.active ? (
                  <Button variant="danger" onClick={() => revoke(l.id)}>
                    Switch off
                  </Button>
                ) : (
                  <Badge tone="info">Not active</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-2xl font-bold">Emergency contacts on the card</h2>
        <form onSubmit={saveContacts} className="mt-3 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-2">
              <Field
                id={`c-name-${i}`}
                label={`Contact ${i + 1} name`}
                value={contacts[i]?.name ?? ""}
                onChange={(e) => setContacts((prev) => Object.assign([...prev], { [i]: { name: e.target.value, phone: prev[i]?.phone ?? "" } }))}
              />
              <Field
                id={`c-phone-${i}`}
                label={`Contact ${i + 1} phone`}
                type="tel"
                value={contacts[i]?.phone ?? ""}
                onChange={(e) => setContacts((prev) => Object.assign([...prev], { [i]: { name: prev[i]?.name ?? "", phone: e.target.value } }))}
              />
            </div>
          ))}
          <Button type="submit">Save contacts</Button>
          {savedContacts ? <Notice tone="ok">Contacts saved.</Notice> : null}
        </form>
      </Card>
    </div>
  );
}

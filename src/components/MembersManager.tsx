"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "@/lib/client/api";
import type { Role, Visibility } from "@/lib/models";
import { formatDateTime } from "@/lib/time";
import { Badge, Button, Card, ErrorState, LoadingState, Notice, PageHeader } from "./ui";

interface MemberView {
  id: string;
  name: string;
  role: Role;
  email: string | null;
  visibility: Visibility | null;
  active: boolean;
}

const VIS_LABELS: Array<{ key: keyof Visibility; label: string }> = [
  { key: "doses", label: "Which doses I take" },
  { key: "missedReasons", label: "Why I missed a dose" },
  { key: "symptoms", label: "My health notes and side effects" },
  { key: "appointments", label: "My doctor visits" },
  { key: "stock", label: "Medicine stock and refills" },
];

const ROLE_LABEL: Record<Role, string> = { ELDER: "Elder (owner)", CARETAKER: "Caretaker", FAMILY: "Family" };

function InvitePanel({ canInviteCaretaker }: { canInviteCaretaker: boolean }) {
  const [invite, setInvite] = useState<{ code: string; circleCode: string; expiresAt: string; role: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(role: "FAMILY" | "CARETAKER") {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ code: string; circleCode: string; expiresAt: string }>("/api/invites", { body: { role } });
      setInvite({ ...res, role });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold">Invite someone</h2>
      <p className="mt-1 text-muted">Each invite passcode works once and expires in 48 hours.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => create("FAMILY")} disabled={busy}>
          Invite a family member
        </Button>
        {canInviteCaretaker ? (
          <Button variant="secondary" onClick={() => create("CARETAKER")} disabled={busy}>
            Invite a caretaker
          </Button>
        ) : null}
      </div>
      {error ? <div className="mt-3"><Notice tone="danger">{error}</Notice></div> : null}
      {invite ? (
        <div className="mt-4" aria-live="polite">
          <Notice tone="ok" title={`Invite for a ${invite.role.toLowerCase()} created`}>
            <p>
              Circle code: <strong className="font-mono text-xl">{invite.circleCode}</strong>
            </p>
            <p>
              Invite passcode: <strong className="font-mono text-xl">{invite.code}</strong>
            </p>
            <p className="text-sm">Share both in person or by phone. This passcode is shown only once. Expires {formatDateTime(invite.expiresAt)}.</p>
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}

function VisibilityEditor({ member, onSaved }: { member: MemberView; onSaved: () => void }) {
  const [vis, setVis] = useState<Visibility>(member.visibility as Visibility);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const dirty = JSON.stringify(vis) !== JSON.stringify(member.visibility);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/members/${encodeURIComponent(member.id)}`, { method: "PATCH", body: { visibility: vis } });
      setMsg({ tone: "ok", text: "Saved. This change is recorded in your consent history." });
      onSaved();
    } catch (err) {
      setMsg({ tone: "danger", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="mt-3">
      <legend className="font-semibold">What {member.name} can see</legend>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {VIS_LABELS.map((v) => (
          <label key={v.key} className="flex min-h-12 items-center gap-3 text-lg">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={vis[v.key]}
              onChange={(e) => setVis((prev) => ({ ...prev, [v.key]: e.target.checked }))}
            />
            {v.label}
          </label>
        ))}
      </div>
      {dirty ? (
        <Button className="mt-2" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save sharing settings"}
        </Button>
      ) : null}
      {msg ? <div className="mt-2"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
    </fieldset>
  );
}

export function MembersManager({ myRole, myId }: { myRole: Role; myId: string }) {
  const [members, setMembers] = useState<MemberView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isElder = myRole === "ELDER";

  const load = useCallback(async () => {
    try {
      setMembers((await api<{ members: MemberView[] }>("/api/members")).members);
      setError(null);
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(m: MemberView) {
    if (!window.confirm(`Remove ${m.name}'s access now? They will be signed out immediately.`)) return;
    try {
      await api(`/api/members/${encodeURIComponent(m.id)}`, { method: "PATCH", body: { active: false } });
      setNotice(`${m.name} no longer has access. This is recorded in the activity log.`);
      await load();
    } catch (err) {
      setNotice(errorText(err));
    }
  }

  if (error && !members) return <ErrorState message={error} onRetry={load} />;
  if (!members) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isElder ? "Who can see what" : "Care circle"}
        subtitle={isElder ? "You decide what each family member can see. Caretakers need full access to manage care." : "Members of this care circle."}
      />
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {myRole !== "FAMILY" ? <InvitePanel canInviteCaretaker={myRole === "ELDER" || myRole === "CARETAKER"} /> : null}
      <ul className="space-y-4">
        {members.map((m) => (
          <li key={m.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold">
                    {m.name} {m.id === myId ? <span className="text-muted">(you)</span> : null}
                  </h2>
                  {m.email ? <p className="text-muted">{m.email}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.active ? "info" : "danger"}>{m.active ? ROLE_LABEL[m.role] : "Access removed"}</Badge>
                  {isElder && m.active && m.role !== "ELDER" ? (
                    <Button variant="danger" onClick={() => revoke(m)}>
                      Remove access
                    </Button>
                  ) : null}
                </div>
              </div>
              {isElder && m.active && m.role === "FAMILY" && m.visibility ? <VisibilityEditor member={m} onSaved={load} /> : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

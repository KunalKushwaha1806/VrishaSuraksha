import type { Metadata } from "next";
import { Card, Disclaimer } from "@/components/ui";
import { logActivity } from "@/lib/activity";
import { getDb } from "@/lib/db";
import { C, type Appointment, type Medication, type Member } from "@/lib/models";
import { resolveShareToken } from "@/lib/services/care";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Emergency card", robots: { index: false, follow: false } };

/** Public, read-only, time-limited emergency card opened from the QR code. */
export default async function EmergencyCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveShareToken(token);
  if (!resolved) {
    return (
      <main id="main" className="mx-auto max-w-xl px-5 py-10">
        <h1 className="text-3xl font-bold">This emergency card is not active</h1>
        <p className="mt-3 text-lg text-muted">It may have expired or been switched off by its owner.</p>
      </main>
    );
  }
  const { circle, share } = resolved;
  await logActivity(circle.id, null, "emergency card was opened", "share", share.id);
  const db = await getDb();
  const [elder, meds, appts, members] = await Promise.all([
    db.get<Member>(C.members(circle.id), circle.elderMemberId),
    db.query<Medication>(C.medications(circle.id), { where: [["active", "==", true]] }),
    db.query<Appointment>(C.appointments(circle.id), { orderBy: { field: "startsAt" } }),
    db.query<Member>(C.members(circle.id)),
  ]);
  const doctors = [...new Set(appts.map((a) => a.doctor))];
  const nextVisit = appts.find((a) => a.startsAt >= new Date().toISOString());
  const caretakers = members.filter((m) => m.active && m.role === "CARETAKER").map((m) => m.name);

  return (
    <main id="main" className="mx-auto max-w-xl space-y-4 px-5 py-8">
      <header>
        <p className="font-semibold text-danger">EMERGENCY MEDICAL CARD · read-only</p>
        <h1 className="text-3xl font-bold">{elder?.name}</h1>
      </header>
      <Card>
        <h2 className="text-xl font-bold">Current medicines</h2>
        <ul className="mt-2 space-y-1">
          {meds.map((m) => (
            <li key={m.id}>
              <strong>{m.name}</strong> {m.doseText} · {m.schedule.times.join(", ")}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="text-xl font-bold">Emergency contacts</h2>
        <ul className="mt-2 space-y-1">
          {circle.emergencyContacts.map((c) => (
            <li key={c.phone}>
              {c.name}:{" "}
              <a className="font-semibold text-brand underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>
                {c.phone}
              </a>
            </li>
          ))}
          {circle.emergencyContacts.length === 0 ? <li className="text-muted">None listed.</li> : null}
        </ul>
        {caretakers.length ? <p className="mt-2 text-muted">Caretaker: {caretakers.join(", ")}</p> : null}
      </Card>
      {doctors.length ? (
        <Card>
          <h2 className="text-xl font-bold">Doctors</h2>
          <p className="mt-2">{doctors.join(" · ")}</p>
          {nextVisit ? <p className="text-muted">Next visit: {formatDateTime(nextVisit.startsAt)}</p> : null}
        </Card>
      ) : null}
      <Disclaimer />
    </main>
  );
}

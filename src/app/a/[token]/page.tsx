import type { Metadata } from "next";
import { ActionButtons } from "@/components/ActionButtons";
import { isActionTokenUsed, verifyActionToken } from "@/lib/actionTokens";
import { getDb } from "@/lib/db";
import { C, type DoseEvent, type Medication, type Member } from "@/lib/models";
import { formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Quick action", robots: { index: false, follow: false } };

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-10 text-xl">
      <p className="font-semibold text-brand">VridhaSuraksha</p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}

/**
 * Landing page for one-tap email links. Opening it changes nothing (safe for
 * link scanners); the person presses a button to perform the single action.
 */
export default async function ActionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claims = await verifyActionToken(token);
  if (!claims) return <Shell title="This link has expired">Please open the app to continue.</Shell>;
  if (await isActionTokenUsed(claims.jti)) return <Shell title="Already done">This link has been used. Thank you!</Shell>;

  const db = await getDb();
  const member = await db.get<Member>(C.members(claims.circleId), claims.memberId);
  if (!member?.active) return <Shell title="This link is no longer valid" />;
  const hi = member.language === "hi";

  if (claims.kind === "refill") {
    const med = await db.get<Medication>(C.medications(claims.circleId), claims.ref);
    if (!med) return <Shell title="This medicine is no longer listed" />;
    return (
      <Shell title={`Refill ${med.name}?`}>
        <p>Let everyone know you will take care of this refill.</p>
        <ActionButtons token={token} kind="refill" lang={member.language} />
      </Shell>
    );
  }

  const dose = await db.get<DoseEvent>(C.doses(claims.circleId), claims.ref);
  if (!dose) return <Shell title="This dose is no longer scheduled" />;
  if (dose.status === "TAKEN") return <Shell title={hi ? "यह खुराक पहले ही दर्ज है" : "This dose is already logged as taken"} />;
  return (
    <Shell title={`${dose.medName} · ${formatTime(dose.scheduledFor)}`}>
      <ActionButtons token={token} kind="dose" lang={member.language} onBehalf={member.role !== "ELDER"} />
    </Shell>
  );
}

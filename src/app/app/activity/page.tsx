import type { Metadata } from "next";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/auth/requirePage";
import { getDb } from "@/lib/db";
import { C, type ActivityEntry, type ConsentEntry } from "@/lib/models";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Activity" };

/** Elder-only audit trail: who viewed or changed what, and every sharing change. */
export default async function ActivityPage() {
  const { circle } = await requirePage("activity:read");
  const db = await getDb();
  const [activity, consent] = await Promise.all([
    db.query<ActivityEntry>(C.activity(circle.id), { orderBy: { field: "at", direction: "desc" }, limit: 100 }),
    db.query<ConsentEntry>(C.consent(circle.id), { orderBy: { field: "at", direction: "desc" }, limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" subtitle="Everything that happens in your circle is recorded here, for you." />
      <Card>
        <h2 className="text-2xl font-bold">Recent activity</h2>
        {activity.length === 0 ? (
          <EmptyState title="Nothing yet" />
        ) : (
          <ol className="mt-3 divide-y divide-line">
            {activity.map((a) => (
              <li key={a.id} className="py-3">
                <p>
                  <strong>{a.actorName}</strong> {a.action}
                </p>
                <p className="text-sm text-muted">
                  <time dateTime={a.at}>{formatDateTime(a.at)}</time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card>
        <h2 className="text-2xl font-bold">Sharing history</h2>
        {consent.length === 0 ? (
          <p className="mt-2 text-muted">No sharing changes yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-line">
            {consent.map((c) => (
              <li key={c.id} className="py-3">
                <p>
                  <strong>{c.memberName}</strong>: {c.change}
                </p>
                <p className="text-sm text-muted">
                  <time dateTime={c.at}>{formatDateTime(c.at)}</time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

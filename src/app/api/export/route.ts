import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { route } from "@/lib/http";
import { exportCircle } from "@/lib/services/circles";

/** Elder-only: download everything held about them as JSON. */
export const GET = route({ permission: "data:export", perMinute: 5 }, async ({ auth }) => {
  const data = await exportCircle(auth.circle);
  await logActivity(auth.circle.id, auth.member, "exported all data", "circle", auth.circle.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vridhasuraksha-export-${data.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

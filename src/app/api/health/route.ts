import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorMessage, log } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Uptime check: confirms the app can reach its database. */
export async function GET(): Promise<NextResponse> {
  try {
    const db = await getDb();
    await db.get("system", "health");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    log.error("Health check failed", { error: errorMessage(err) });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

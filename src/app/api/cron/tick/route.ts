import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { toErrorResponse } from "@/lib/http";
import { tick } from "@/lib/services/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called every minute by Google Cloud Scheduler with
 * "Authorization: Bearer <CRON_SECRET>". Generates upcoming doses and sends
 * due reminders exactly once.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !safeEqual(provided, env().CRON_SECRET)) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Unauthorized" } }, { status: 401 });
  }
  try {
    return NextResponse.json(await tick());
  } catch (err) {
    return toErrorResponse(err);
  }
}

export const GET = handle;
export const POST = handle;

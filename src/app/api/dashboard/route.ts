import { route } from "@/lib/http";
import { buildDashboard } from "@/lib/services/dashboard";

/** Everything one screen needs, in one request. Polled every 30 seconds. */
export const GET = route({ permission: "circle:read", perMinute: 60 }, async ({ auth }) => buildDashboard(auth));

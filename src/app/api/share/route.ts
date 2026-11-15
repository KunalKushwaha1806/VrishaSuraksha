import QRCode from "qrcode";
import { env } from "@/lib/env";
import { route } from "@/lib/http";
import { createShareToken, listShareTokens } from "@/lib/services/care";
import { shareCreateSchema } from "@/lib/validation";

export const GET = route({ permission: "share:manage" }, async ({ auth }) => {
  const now = new Date().toISOString();
  const tokens = await listShareTokens(auth.circle.id);
  return {
    links: tokens.map((t) => ({
      id: t.id,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      active: !t.revokedAt && t.expiresAt > now,
    })),
  };
});

/** Elder-only: creates a time-limited, read-only emergency card link and its QR code. */
export const POST = route(
  { permission: "share:manage", body: shareCreateSchema, perMinute: 10 },
  async ({ auth, body }) => {
    const { token, share } = await createShareToken(auth.circle, auth.member, body.hours);
    const url = `${env().APP_URL}/e/${token}`;
    const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return {
      url,
      qrDataUrl: `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`,
      expiresAt: share.expiresAt,
      id: share.id,
    };
  },
);

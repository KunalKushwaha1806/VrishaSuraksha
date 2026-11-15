import { z } from "zod";

/**
 * Typed, validated access to environment variables.
 * Production refuses to start with missing secrets; development gets
 * clearly-labelled throwaway defaults so the app runs with zero setup.
 */
const isProd = process.env.NODE_ENV === "production";

const DEV_JWT_SECRET = "dev-only-jwt-secret-change-me-0123456789abcdef";
const DEV_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const DEV_CRON_SECRET = "dev-cron-secret";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  CRON_SECRET: z.string().min(12),
  DATA_BACKEND: z.enum(["firestore", "memory"]),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("VridhaSuraksha <no-reply@vridhasuraksha.local>"),
  TTS_ENABLED: bool,
  DEMO_MODE: bool,
  DEMO_INBOX: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const raw = process.env;
  const parsed = schema.safeParse({
    ...raw,
    JWT_SECRET: raw.JWT_SECRET ?? (isProd ? undefined : DEV_JWT_SECRET),
    ENCRYPTION_KEY: raw.ENCRYPTION_KEY ?? (isProd ? undefined : DEV_ENCRYPTION_KEY),
    CRON_SECRET: raw.CRON_SECRET ?? (isProd ? undefined : DEV_CRON_SECRET),
    DATA_BACKEND: raw.DATA_BACKEND ?? (isProd ? "firestore" : "memory"),
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: forget the cached config after mutating process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export const features = {
  ai: () => Boolean(env().GEMINI_API_KEY),
  email: () => Boolean(env().SMTP_HOST && env().SMTP_USER && env().SMTP_PASS),
  tts: () => env().TTS_ENABLED,
  demo: () => env().DEMO_MODE,
};

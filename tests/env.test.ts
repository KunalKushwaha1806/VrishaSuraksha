import { afterEach, describe, expect, it } from "vitest";
import { env, googleClientOptions, resetEnvCache } from "@/lib/env";

const KEY = {
  type: "service_account",
  project_id: "vs-firebase",
  client_email: "app@vs-firebase.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
};

const saved = { ...process.env };

function withEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
}

afterEach(() => {
  process.env = { ...saved };
  resetEnvCache();
});

describe("googleClientOptions", () => {
  it("uses only the project id when no key is given (Cloud Run)", () => {
    withEnv({ GOOGLE_CREDENTIALS: undefined, GOOGLE_CLOUD_PROJECT: "my-project" });
    expect(googleClientOptions()).toEqual({ projectId: "my-project" });
  });

  it("reads a service-account key given as JSON", () => {
    withEnv({ GOOGLE_CREDENTIALS: JSON.stringify(KEY), GOOGLE_CLOUD_PROJECT: undefined });
    expect(googleClientOptions()).toEqual({
      projectId: "vs-firebase",
      credentials: { client_email: KEY.client_email, private_key: KEY.private_key },
    });
  });

  it("reads a base64 key and repairs escaped line breaks", () => {
    const escaped = { ...KEY, private_key: KEY.private_key.replace(/\n/g, "\\n") };
    withEnv({ GOOGLE_CREDENTIALS: Buffer.from(JSON.stringify(escaped)).toString("base64") });
    expect(googleClientOptions().credentials?.private_key).toBe(KEY.private_key);
  });

  it("rejects a key without credentials", () => {
    withEnv({ GOOGLE_CREDENTIALS: JSON.stringify({ project_id: "x" }) });
    expect(() => googleClientOptions()).toThrow(/client_email/);
  });

  it("rejects text that is not JSON", () => {
    withEnv({ GOOGLE_CREDENTIALS: "not a key" });
    expect(() => googleClientOptions()).toThrow(/not valid/);
  });
});

describe("APP_URL", () => {
  it("falls back to the address Render publishes", () => {
    withEnv({ APP_URL: undefined, RENDER_EXTERNAL_URL: "https://vridhasuraksha.onrender.com" });
    expect(env().APP_URL).toBe("https://vridhasuraksha.onrender.com");
  });

  it("falls back to the Vercel production domain", () => {
    withEnv({ APP_URL: undefined, RENDER_EXTERNAL_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: "vridhasuraksha.vercel.app" });
    expect(env().APP_URL).toBe("https://vridhasuraksha.vercel.app");
  });

  it("prefers an explicit APP_URL", () => {
    withEnv({ APP_URL: "https://care.example.org", RENDER_EXTERNAL_URL: "https://x.onrender.com" });
    expect(env().APP_URL).toBe("https://care.example.org");
  });
});

"use client";

/** Typed fetch wrapper for the browser. Throws ApiClientError with the server's friendly message. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError(0, "offline", "You seem to be offline. Please check your connection.");
  }
  if (res.status === 401 && !path.startsWith("/api/auth") && !path.startsWith("/api/action")) {
    window.location.assign("/login?expired=1");
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const { code = "error", message = "Something went wrong.", ...details } = data?.error ?? {};
    throw new ApiClientError(res.status, code, message, details);
  }
  return data as T;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Field-level messages from a 400 response, keyed by field path. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiClientError)) return {};
  const fields = (err.details.fields as Array<{ path: string; message: string }> | undefined) ?? [];
  return Object.fromEntries(fields.map((f) => [f.path, f.message]));
}

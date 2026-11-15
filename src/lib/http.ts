import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { currentAuth, type AuthContext } from "./auth/session";
import { can, type Permission } from "./domain/permissions";
import { errorMessage, log } from "./logger";
import { hitLimit } from "./ratelimit";

/** Error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const fail = {
  badRequest: (message = "The request was not valid.", details?: Record<string, unknown>) =>
    new ApiError(400, "bad_request", message, details),
  unauthorized: (message = "Please sign in again.") => new ApiError(401, "unauthorized", message),
  forbidden: (message = "You do not have permission to do that.") => new ApiError(403, "forbidden", message),
  notFound: (message = "Not found.") => new ApiError(404, "not_found", message),
  conflict: (message: string, details?: Record<string, unknown>) => new ApiError(409, "conflict", message, details),
  tooLarge: (message = "That upload is too large.") => new ApiError(413, "too_large", message),
  tooMany: (retryAfterSec: number) =>
    new ApiError(429, "rate_limited", `Too many attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`, {
      retryAfterSec,
    }),
  unavailable: (message: string) => new ApiError(503, "unavailable", message),
};

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Reads a JSON body while enforcing a byte limit, so huge payloads are rejected early. */
export async function readJson(req: NextRequest, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw fail.tooLarge();
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw fail.tooLarge();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw fail.badRequest("Body must be valid JSON.");
  }
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, ...err.details } }, { status: err.status });
  }
  log.error("Unhandled API error", { error: errorMessage(err) });
  return NextResponse.json(
    { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
    { status: 500 },
  );
}

type RouteParams = Record<string, string>;

export interface Ctx<B, A> {
  req: NextRequest;
  body: B;
  params: RouteParams;
  auth: A;
  ip: string;
}

interface BaseOptions<S extends ZodType | undefined> {
  body?: S;
  /** Maximum request body in bytes (default 32 KB). */
  maxBytes?: number;
  /** Per-IP request budget per minute (default 120). */
  perMinute?: number;
}

type BodyOf<S> = S extends ZodType ? z.infer<S> : undefined;
type NextCtx = { params: Promise<RouteParams> };

/**
 * Wraps a route handler with input validation, rate limiting, consistent
 * error shapes and, unless `public` is set, server-side role checks.
 * No route can forget to authorise: a permission is a required option.
 */
export function route<S extends ZodType | undefined = undefined>(
  options: BaseOptions<S> & { permission: Permission },
  handler: (ctx: Ctx<BodyOf<S>, AuthContext>) => Promise<unknown>,
): (req: NextRequest, ctx: NextCtx) => Promise<NextResponse>;
export function route<S extends ZodType | undefined = undefined>(
  options: BaseOptions<S> & { public: true },
  handler: (ctx: Ctx<BodyOf<S>, AuthContext | null>) => Promise<unknown>,
): (req: NextRequest, ctx: NextCtx) => Promise<NextResponse>;
export function route<S extends ZodType | undefined, A extends AuthContext | null>(
  options: BaseOptions<S> & { permission?: Permission; public?: true },
  handler: (ctx: Ctx<BodyOf<S>, A>) => Promise<unknown>,
) {
  return async (req: NextRequest, nextCtx: NextCtx): Promise<NextResponse> => {
    try {
      const ip = clientIp(req);
      const budget = hitLimit(`api:${ip}`, options.perMinute ?? 120, 60_000);
      if (!budget.ok) throw fail.tooMany(budget.retryAfterSec);

      const auth = await currentAuth();
      if (!options.public) {
        if (!auth) throw fail.unauthorized();
        if (options.permission && !can(auth.member.role, options.permission)) throw fail.forbidden();
      }

      let body: unknown = undefined;
      if (options.body) {
        const raw = await readJson(req, options.maxBytes ?? 32 * 1024);
        const parsed = options.body.safeParse(raw);
        if (!parsed.success) {
          throw fail.badRequest("Some fields need attention.", {
            fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        body = parsed.data;
      }

      const params = (await nextCtx.params) ?? {};
      // Safe: when not public, auth was verified non-null above.
      const result = await handler({ req, body: body as BodyOf<S>, params, auth: auth as A, ip });
      if (result instanceof NextResponse || result instanceof Response) return result as NextResponse;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

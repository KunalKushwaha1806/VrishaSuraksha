import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { ApiError, clientIp, fail, readJson, requireRole, toErrorResponse } from "@/lib/http";
import type { Member } from "@/lib/models";

describe("HTTP Helpers & ApiError", () => {
  it("formats ApiError into consistent status and JSON structure", async () => {
    const err = fail.badRequest("Invalid parameter", { field: "name" });
    expect(err.status).toBe(400);
    expect(err.code).toBe("bad_request");

    const res = toErrorResponse(err);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "bad_request", message: "Invalid parameter", field: "name" },
    });
  });

  it("handles various fail helpers correctly", () => {
    expect(fail.unauthorized().status).toBe(401);
    expect(fail.forbidden().status).toBe(403);
    expect(fail.notFound().status).toBe(404);
    expect(fail.conflict("Already exists").status).toBe(409);
    expect(fail.tooLarge().status).toBe(413);
    expect(fail.tooMany(120).status).toBe(429);
    expect(fail.unavailable("Service busy").status).toBe(503);
  });

  it("masks unhandled internal errors", async () => {
    const rawError = new Error("Database connection dropped unexpectedly");
    const res = toErrorResponse(rawError);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
    expect(body.error.message).not.toContain("Database connection dropped");
  });

  it("extracts client IP from standard forwarding headers", () => {
    const reqWithForwarded = new NextRequest("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
    });
    expect(clientIp(reqWithForwarded)).toBe("203.0.113.195");

    const reqWithRealIp = new NextRequest("http://localhost:3000/api/test", {
      headers: { "x-real-ip": "198.51.100.4" },
    });
    expect(clientIp(reqWithRealIp)).toBe("198.51.100.4");
  });

  it("enforces payload byte limits during JSON reading", async () => {
    const validReq = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ key: "val" }),
    });
    const parsed = await readJson(validReq, 1024);
    expect(parsed).toEqual({ key: "val" });

    const oversizedReq = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      body: JSON.stringify({ huge: "x".repeat(2000) }),
    });
    await expect(readJson(oversizedReq, 500)).rejects.toThrow(ApiError);
  });

  it("enforces role requirements", () => {
    const caretaker: Pick<Member, "role"> = { role: "CARETAKER" };
    expect(() => requireRole(caretaker, "CARETAKER", "ELDER")).not.toThrow();
    expect(() => requireRole(caretaker, "ELDER")).toThrow(ApiError);
  });
});

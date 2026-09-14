import type { NextRequest } from "next/server";
import { json, httpError, clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createRoom, RoomError } from "@/lib/rooms";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limit = rateLimit(`rooms:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return httpError(429, "rate limit exceeded", { resetAt: limit.resetAt });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid JSON body");
  }

  try {
    const result = await createRoom(body as Parameters<typeof createRoom>[0]);
    return json(result, { status: 201 });
  } catch (e) {
    if (e instanceof RoomError) return httpError(e.status, e.message, e.reasons ? { reasons: e.reasons } : undefined);
    console.error("createRoom failed", e);
    return httpError(500, "internal error");
  }
}

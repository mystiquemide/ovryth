import { json, httpError } from "@/lib/http";
import { updateRules, RoomError } from "@/lib/rooms";

export const runtime = "nodejs";

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: { rules?: unknown; ownerSignature?: string; issuedAt?: string };
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid JSON body");
  }
  if (!body.ownerSignature || !body.issuedAt) return httpError(400, "ownerSignature and issuedAt are required");

  try {
    const result = await updateRules(slug, (body.rules ?? {}) as Parameters<typeof updateRules>[1], body.ownerSignature as `0x${string}`, body.issuedAt);
    return json(result);
  } catch (e) {
    if (e instanceof RoomError) return httpError(e.status, e.message, e.reasons ? { reasons: e.reasons } : undefined);
    console.error("updateRules failed", e);
    return httpError(500, "internal error");
  }
}

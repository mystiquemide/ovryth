import { json, httpError } from "@/lib/http";
import { setPaused, RoomError } from "@/lib/rooms";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: { paused?: boolean; ownerSignature?: string; issuedAt?: string };
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid JSON body");
  }
  if (typeof body.paused !== "boolean" || !body.ownerSignature || !body.issuedAt) {
    return httpError(400, "paused (boolean), ownerSignature, and issuedAt are required");
  }

  try {
    const result = await setPaused(slug, body.paused, body.ownerSignature as `0x${string}`, body.issuedAt);
    return json(result);
  } catch (e) {
    if (e instanceof RoomError) return httpError(e.status, e.message);
    console.error("setPaused failed", e);
    return httpError(500, "internal error");
  }
}

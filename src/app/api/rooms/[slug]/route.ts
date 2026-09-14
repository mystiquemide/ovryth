import { json, httpError } from "@/lib/http";
import { getPublicRoom, RoomError } from "@/lib/rooms";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  try {
    return json(await getPublicRoom(slug));
  } catch (e) {
    if (e instanceof RoomError) return httpError(e.status, e.message);
    console.error("getPublicRoom failed", e);
    return httpError(500, "internal error");
  }
}

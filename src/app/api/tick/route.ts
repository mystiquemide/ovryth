import { json, httpError } from "@/lib/http";
import { runTick } from "@/lib/sweeper/tick";

export const runtime = "nodejs";
export const maxDuration = 60;

async function sweep() {
  try {
    return json(await runTick());
  } catch (e) {
    console.error("tick failed", e);
    return httpError(500, "tick failed");
  }
}

/** Sweeper, hit every minute by the VPS crontab. Bearer TICK_SECRET. */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.TICK_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) return httpError(401, "unauthorized");
  return sweep();
}

/** Vercel Cron calls this path with Bearer CRON_SECRET. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) return httpError(401, "unauthorized");
  return sweep();
}

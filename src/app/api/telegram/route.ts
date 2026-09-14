import { after } from "next/server";
import type { NextRequest } from "next/server";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/handle";

export const runtime = "nodejs";

/**
 * Telegram webhook. Validates the secret header, returns 200 immediately, and does all
 * intake/scoring/payout work in after() so Telegram is never kept waiting (it retries on
 * non-200 and would duplicate updates). Idempotency is enforced on (roomId, messageId).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  after(async () => {
    try {
      await handleUpdate(update);
    } catch (e) {
      console.error("handleUpdate failed", e);
    }
  });

  return new Response("ok", { status: 200 });
}

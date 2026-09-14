/** Raw Telegram Bot API over fetch (no framework). */

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

export async function tg<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

export function sendMessage(
  chatId: number | bigint | string,
  text: string,
  opts: { replyToMessageId?: number; disablePreview?: boolean } = {},
) {
  return tg("sendMessage", {
    chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
    text,
    disable_web_page_preview: opts.disablePreview ?? true,
    ...(opts.replyToMessageId ? { reply_parameters: { message_id: opts.replyToMessageId, allow_sending_without_reply: true } } : {}),
  }).catch((e) => {
    // Never let a reply failure break the pipeline, but make it greppable so a silent
    // missing verdict is visible in logs and can be retried by the sweeper.
    console.error(`[telegram] sendMessage failed to chat ${String(chatId)}:`, e instanceof Error ? e.message : e);
    return null;
  });
}

/** The bot's own Telegram user id, fetched once and cached. */
let cachedBotId: number | null = null;
export async function botUserId(): Promise<number> {
  if (cachedBotId) return cachedBotId;
  const me = await tg<{ id: number }>("getMe", {});
  cachedBotId = me.id;
  return me.id;
}

/** True when the user is a creator or administrator of the chat. False on any API error. */
export async function isChatAdmin(chatId: number | bigint, userId: number | bigint): Promise<boolean> {
  try {
    const m = await tg<{ status: string }>("getChatMember", {
      chat_id: typeof chatId === "bigint" ? chatId.toString() : chatId,
      user_id: typeof userId === "bigint" ? userId.toString() : userId,
    });
    return m.status === "creator" || m.status === "administrator";
  } catch {
    return false;
  }
}

export function baseScanTx(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

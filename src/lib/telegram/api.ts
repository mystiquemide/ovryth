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
    // Never let a reply failure break the pipeline.
    console.error("sendMessage failed", e);
    return null;
  });
}

export function baseScanTx(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

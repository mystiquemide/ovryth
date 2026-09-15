/**
 * Turn a thrown error into one human sentence with a next step. Wallet and RPC
 * errors arrive as raw internals ("User rejected the request", hex dumps); API
 * routes already return short human strings. Never surface raw internals.
 */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const s = raw.toLowerCase();

  if (s.includes("user rejected") || s.includes("user denied") || s.includes("rejected the request") || s.includes("cancelled") || s.includes("canceled"))
    return "Signature cancelled. Nothing changed. Try again when you're ready.";
  if (s.includes("rate limit"))
    return "Too many requests. Wait a minute and try again.";
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("timed out") || s.includes("timeout"))
    return "Couldn't reach the server. Check your connection and try again.";
  if (s.includes("insufficient funds"))
    return "The account can't cover the transaction fee. Top up ETH on Base and try again.";
  if (raw === "internal error")
    return "Error on our side. Try again in a minute.";

  // API errors are already short human sentences; pass them through.
  if (raw.length <= 140 && !s.includes("0x") && !s.includes("error:")) return raw;

  return "That didn't go through. Try again, or check ovryth.midelabs.xyz/status.";
}

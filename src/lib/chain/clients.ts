import { createPublicClient, createWalletClient, fallback, http, type Account } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URLS, RECEIPT_RPC_URL } from "./config";

/** Read client with ordered RPC fallback. */
export const publicClient = createPublicClient({
  chain: base,
  transport: fallback(RPC_URLS.map((url) => http(url))),
});

/** Receipts are read from the primary only (some fallbacks reject archive-style receipt reads). */
export const receiptClient = createPublicClient({
  chain: base,
  transport: http(RECEIPT_RPC_URL),
});

/** Operator wallet client (only ever calls OvrythPayer.pay / setOperator). Server-side only. */
export function getOperatorWalletClient() {
  const pk = process.env.OVRYTH_OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OVRYTH_OPERATOR_PRIVATE_KEY is not set");
  const account: Account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain: base, transport: fallback(RPC_URLS.map((url) => http(url))) });
}

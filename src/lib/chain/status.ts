import { getPermissionStatus as sdkGetPermissionStatus } from "@base-org/account/spend-permission";
import type { Hex } from "viem";
import { CHAIN_ID, RECEIPT_RPC_URL } from "./config";
import type { SpendPermission } from "./permission";

/** Typed, fail-closed view of a permission's on-chain state. */
export interface PermissionStatus {
  isActive: boolean;
  isApprovedOnchain: boolean;
  isRevoked: boolean;
  isExpired: boolean;
  remainingSpend: bigint;
  nextPeriodStart: Date;
  currentPeriod: { start: number; end: number; spend: bigint };
}

/** Thrown when on-chain status cannot be read. Callers MUST treat this as "do not pay". */
export class ChainStatusError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ChainStatusError";
  }
}

/** SDK permission shape (string-encoded numeric fields). */
function toSdkPermission(p: SpendPermission, signature: Hex) {
  return {
    signature,
    chainId: CHAIN_ID,
    permission: {
      account: p.account,
      spender: p.spender,
      token: p.token,
      allowance: p.allowance.toString(),
      period: p.period,
      start: p.start,
      end: p.end,
      salt: p.salt.toString(),
      extraData: p.extraData,
    },
  };
}

/**
 * Read a permission's live status. Fails closed: any RPC/SDK error throws ChainStatusError
 * so the payout path can never proceed on a stale or assumed-good status.
 */
export async function readPermissionStatus(
  p: SpendPermission,
  signature: Hex = "0x",
  opts: { retries?: number } = {},
): Promise<PermissionStatus> {
  const retries = opts.retries ?? 3;
  let last: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const s = await sdkGetPermissionStatus(toSdkPermission(p, signature), { rpcUrl: RECEIPT_RPC_URL });
      return {
        isActive: s.isActive,
        isApprovedOnchain: s.isApprovedOnchain,
        isRevoked: s.isRevoked,
        isExpired: s.isExpired,
        remainingSpend: s.remainingSpend,
        nextPeriodStart: s.nextPeriodStart,
        currentPeriod: s.currentPeriod,
      };
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw new ChainStatusError("failed to read permission status", last);
}

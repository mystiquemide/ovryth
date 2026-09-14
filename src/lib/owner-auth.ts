import { getAddress, type Address, type Hex } from "viem";
import { publicClient } from "./chain";

/** How long a signed owner message stays valid. Blocks replay of an old signature. */
export const OWNER_SIG_TTL_MS = 10 * 60 * 1000;

export interface OwnerMessageParts {
  action: string; // e.g. "create-room", "update-rules", "pause"
  resource: string; // permission hash for create, slug for room-scoped actions
  issuedAt: string; // ISO-8601
}

/** Canonical message the owner signs with their Base Account. */
export function ownerMessage(p: OwnerMessageParts): string {
  return ["Ovryth room authorization", `action: ${p.action}`, `resource: ${p.resource}`, `issuedAt: ${p.issuedAt}`].join("\n");
}

export interface OwnerAuthResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verify an owner action signature. The owner is a Base Account (smart wallet), so we use
 * viem verifyMessage which handles ERC-6492/ERC-1271. Also enforces freshness to prevent replay.
 */
export async function verifyOwnerSignature(
  ownerAccount: Address,
  parts: OwnerMessageParts,
  signature: Hex,
): Promise<OwnerAuthResult> {
  const issuedMs = Date.parse(parts.issuedAt);
  if (Number.isNaN(issuedMs)) return { ok: false, reason: "invalid issuedAt" };
  const age = Date.now() - issuedMs;
  if (age > OWNER_SIG_TTL_MS) return { ok: false, reason: "signature expired" };
  if (age < -60_000) return { ok: false, reason: "issuedAt is in the future" };

  const valid = await publicClient.verifyMessage({
    address: getAddress(ownerAccount),
    message: ownerMessage(parts),
    signature,
  });
  return valid ? { ok: true } : { ok: false, reason: "signature does not match owner account" };
}

import { getAddress, hashTypedData, type Address, type Hex } from "viem";
import { CHAIN_ID, SPEND_PERMISSION_MANAGER, USDC } from "./config";

/** A spend permission, matching SpendPermissionManager.SpendPermission on Base. */
export interface SpendPermission {
  account: Address;
  spender: Address;
  token: Address;
  allowance: bigint;
  period: number;
  start: number;
  end: number;
  salt: bigint;
  extraData: Hex;
}

/** EIP-712 shape of the SpendPermissionManager (must match the deployed contract exactly). */
const SP_TYPES = {
  SpendPermission: [
    { name: "account", type: "address" },
    { name: "spender", type: "address" },
    { name: "token", type: "address" },
    { name: "allowance", type: "uint160" },
    { name: "period", type: "uint48" },
    { name: "start", type: "uint48" },
    { name: "end", type: "uint48" },
    { name: "salt", type: "uint256" },
    { name: "extraData", type: "bytes" },
  ],
} as const;

const DOMAIN = {
  name: "Spend Permission Manager",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: SPEND_PERMISSION_MANAGER,
} as const;

/**
 * Recompute the manager's EIP-712 permission hash from the permission fields.
 * Must equal SpendPermissionManager.getHash(permission) on chain; we never trust a
 * client-supplied hash and always recompute from the fields we store.
 */
export function computePermissionHash(p: SpendPermission): Hex {
  return hashTypedData({
    domain: DOMAIN,
    types: SP_TYPES,
    primaryType: "SpendPermission",
    message: {
      account: getAddress(p.account),
      spender: getAddress(p.spender),
      token: getAddress(p.token),
      allowance: p.allowance,
      period: p.period,
      start: p.start,
      end: p.end,
      salt: p.salt,
      extraData: p.extraData,
    },
  });
}

export interface PermissionCheck {
  ok: boolean;
  hash: Hex;
  reasons: string[];
}

/**
 * Structural validation of a permission before we ever store or spend it. Enforces the
 * locks: the spender must be our payer, the token must be USDC, and the caps must be sane.
 * Signature/approval validity is a separate on-chain concern (see status.ts).
 */
export function verifyPermission(
  p: SpendPermission,
  opts: { payer: Address; expectedHash?: Hex },
): PermissionCheck {
  const reasons: string[] = [];
  const hash = computePermissionHash(p);

  if (getAddress(p.spender) !== getAddress(opts.payer)) reasons.push("spender is not the OvrythPayer contract");
  if (getAddress(p.token) !== getAddress(USDC)) reasons.push("token is not USDC");
  if (p.allowance <= 0n) reasons.push("allowance must be positive");
  if (p.period <= 0) reasons.push("period must be positive");
  if (p.end <= p.start) reasons.push("end must be after start");
  if (opts.expectedHash && hash.toLowerCase() !== opts.expectedHash.toLowerCase()) {
    reasons.push("permission hash does not match the stored hash");
  }

  return { ok: reasons.length === 0, hash, reasons };
}

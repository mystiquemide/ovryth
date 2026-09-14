import { describe, it, expect } from "vitest";
import { getAddress } from "viem";
import { readPermissionStatus, USDC, PAYER_ADDRESS, type SpendPermission } from "../../src/lib/chain";

const PAYER = PAYER_ADDRESS ?? getAddress("0x485457f86fbf5e2385ae183bd5518c7d965e3999");

describe("readPermissionStatus (Base mainnet)", () => {
  it("returns a typed status for an unapproved permission", async () => {
    const now = Math.floor(Date.now() / 1000) - 600;
    const p: SpendPermission = {
      account: getAddress("0x708f281Ada585D116e57aCF650cb28B84e972996"),
      spender: PAYER,
      token: USDC,
      allowance: 1_000_000n,
      period: 86_400,
      start: now,
      end: 281474976710655,
      salt: 987654321n,
      extraData: "0x",
    };

    const s = await readPermissionStatus(p);
    // Unapproved permission: full allowance remains, not revoked, not approved on chain.
    expect(typeof s.isActive).toBe("boolean");
    expect(s.isApprovedOnchain).toBe(false);
    expect(s.isRevoked).toBe(false);
    expect(s.remainingSpend).toBe(1_000_000n);
    expect(s.currentPeriod.spend).toBe(0n);
  });
});

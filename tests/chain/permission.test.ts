import { describe, it, expect } from "vitest";
import { getAddress } from "viem";
import {
  computePermissionHash,
  verifyPermission,
  publicClient,
  SPEND_PERMISSION_MANAGER,
  SPEND_PERMISSION_MANAGER_ABI,
  USDC,
  PAYER_ADDRESS,
  type SpendPermission,
} from "../../src/lib/chain";

const PAYER = PAYER_ADDRESS ?? getAddress("0x485457f86fbf5e2385ae183bd5518c7d965e3999");

function samplePermission(overrides: Partial<SpendPermission> = {}): SpendPermission {
  const now = Math.floor(Date.now() / 1000) - 600;
  return {
    account: getAddress("0x708f281Ada585D116e57aCF650cb28B84e972996"),
    spender: PAYER,
    token: USDC,
    allowance: 1_000_000n,
    period: 86_400,
    start: now,
    end: 281474976710655,
    salt: 123456789n,
    extraData: "0x",
    ...overrides,
  };
}

describe("computePermissionHash", () => {
  it("matches SpendPermissionManager.getHash on Base mainnet", async () => {
    const p = samplePermission();
    const local = computePermissionHash(p);
    const onchain = (await publicClient.readContract({
      address: SPEND_PERMISSION_MANAGER,
      abi: SPEND_PERMISSION_MANAGER_ABI,
      functionName: "getHash",
      args: [p],
    })) as `0x${string}`;
    expect(local.toLowerCase()).toBe(onchain.toLowerCase());
  });

  it("changes when any field changes", () => {
    const base = computePermissionHash(samplePermission());
    expect(computePermissionHash(samplePermission({ salt: 999n }))).not.toBe(base);
    expect(computePermissionHash(samplePermission({ allowance: 2_000_000n }))).not.toBe(base);
  });
});

describe("verifyPermission", () => {
  it("accepts a well-formed permission spendable by the payer", () => {
    const r = verifyPermission(samplePermission(), { payer: PAYER });
    expect(r.ok).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it("rejects a wrong spender", () => {
    const r = verifyPermission(samplePermission({ spender: getAddress("0x000000000000000000000000000000000000dEaD") }), { payer: PAYER });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("spender is not the OvrythPayer contract");
  });

  it("rejects a non-USDC token", () => {
    const r = verifyPermission(samplePermission({ token: getAddress("0x4200000000000000000000000000000000000006") }), { payer: PAYER });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("token is not USDC");
  });

  it("rejects a hash mismatch", () => {
    const p = samplePermission();
    const r = verifyPermission(p, { payer: PAYER, expectedHash: "0x" + "00".repeat(32) as `0x${string}` });
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain("permission hash does not match the stored hash");
  });
});

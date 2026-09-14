import { describe, it, expect } from "vitest";
import { decodeFunctionData, getAddress, toFunctionSelector } from "viem";
import { encodePay, toPayArgs } from "../../src/lib/payout/pay";
import { OVRYTH_PAYER_ABI, type SpendPermission } from "../../src/lib/chain";

const perm: SpendPermission = {
  account: getAddress("0x708f281Ada585D116e57aCF650cb28B84e972996"),
  spender: getAddress("0x485457f86fbf5e2385ae183bd5518c7d965e3999"),
  token: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  allowance: 5_000_000n,
  period: 604800,
  start: 1_700_000_000,
  end: 281474976710655,
  salt: 42n,
  extraData: "0x",
};

describe("encodePay", () => {
  it("encodes pay() with the correct selector and round-trips the args", () => {
    const recipient = getAddress("0x000000000000000000000000000000000000dEaD");
    const data = encodePay(perm, "0xabcd", true, 250_000n, recipient);

    const paySelector = toFunctionSelector("pay((address,address,address,uint160,uint48,uint48,uint48,uint256,bytes),bytes,bool,uint160,address)");
    expect(data.slice(0, 10)).toBe(paySelector);

    const decoded = decodeFunctionData({ abi: OVRYTH_PAYER_ABI, data });
    expect(decoded.functionName).toBe("pay");
    const [p, sig, needsApprove, amount, to] = decoded.args as [ReturnType<typeof toPayArgs>, `0x${string}`, boolean, bigint, `0x${string}`];
    expect(getAddress(p.account)).toBe(perm.account);
    expect(getAddress(p.spender)).toBe(perm.spender);
    expect(BigInt(p.allowance)).toBe(perm.allowance);
    expect(BigInt(p.end)).toBe(BigInt(perm.end));
    expect(sig).toBe("0xabcd");
    expect(needsApprove).toBe(true);
    expect(amount).toBe(250_000n);
    expect(getAddress(to)).toBe(recipient);
  });
});

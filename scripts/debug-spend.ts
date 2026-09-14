/**
 * SIMULATION ONLY (no gas, no broadcast). Reproduces the approve->spend->transfer
 * sequence via eth_simulate and decodes the exact revert reason for `spend`.
 *
 *   npm run debug:spend
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createPublicClient, http, getAddress, formatUnits, encodeFunctionData, decodeErrorResult, hashTypedData, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";

const RPC = process.env.BASE_RPC_URL!;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453");
const USDC = getAddress(process.env.USDC_ADDRESS!);
const MANAGER = getAddress(process.env.SPEND_PERMISSION_MANAGER!);
const ownerEoa = privateKeyToAccount(process.env.DEMO_OWNER_EOA_PRIVATE_KEY! as Hex);
const OWNER_ACCOUNT = getAddress(process.env.DEMO_OWNER_ADDRESS!);
const operator = privateKeyToAccount(process.env.OVRYTH_OPERATOR_PRIVATE_KEY! as Hex);
const recipient = operator.address;

const ALLOWANCE = BigInt(1_000_000);
const SPEND = BigInt(250_000);
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const SP_TYPES = {
  SpendPermission: [
    { name: "account", type: "address" }, { name: "spender", type: "address" }, { name: "token", type: "address" },
    { name: "allowance", type: "uint160" }, { name: "period", type: "uint48" }, { name: "start", type: "uint48" },
    { name: "end", type: "uint48" }, { name: "salt", type: "uint256" }, { name: "extraData", type: "bytes" },
  ],
} as const;

const ERC20_TRANSFER_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// SpendPermission struct + manager entrypoints for encoding.
const SP_STRUCT = { name: "spendPermission", type: "tuple", components: SP_TYPES.SpendPermission } as const;
const MANAGER_ABI = [
  { name: "approveWithSignature", type: "function", stateMutability: "nonpayable", inputs: [SP_STRUCT, { name: "signature", type: "bytes" }], outputs: [] },
  { name: "spend", type: "function", stateMutability: "nonpayable", inputs: [SP_STRUCT, { name: "value", type: "uint160" }], outputs: [] },
] as const;

// Manager custom errors (+ Coinbase wallet Unauthorized) for decoding reverts.
const ERROR_ABI = [
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "InvalidSender", inputs: [{ name: "sender", type: "address" }, { name: "expected", type: "address" }] },
  { type: "error", name: "InvalidSignature", inputs: [] },
  { type: "error", name: "UnauthorizedSpendPermission", inputs: [] },
  { type: "error", name: "ExceededSpendPermission", inputs: [{ name: "value", type: "uint256" }, { name: "allowance", type: "uint256" }] },
  { type: "error", name: "ZeroValue", inputs: [] },
  { type: "error", name: "ZeroToken", inputs: [] },
  { type: "error", name: "ZeroSpender", inputs: [] },
  { type: "error", name: "ZeroPeriod", inputs: [] },
  { type: "error", name: "ZeroAllowance", inputs: [] },
  { type: "error", name: "BeforeSpendPermissionStart", inputs: [{ name: "currentTimestamp", type: "uint48" }, { name: "start", type: "uint48" }] },
  { type: "error", name: "AfterSpendPermissionEnd", inputs: [{ name: "currentTimestamp", type: "uint48" }, { name: "end", type: "uint48" }] },
  { type: "error", name: "InvalidStartEnd", inputs: [{ name: "start", type: "uint48" }, { name: "end", type: "uint48" }] },
  { type: "error", name: "SpendValueOverflow", inputs: [{ name: "value", type: "uint256" }] },
  { type: "error", name: "UnexpectedReceiveAmount", inputs: [{ name: "received", type: "uint256" }, { name: "expected", type: "uint256" }] },
  { type: "error", name: "MismatchedAccounts", inputs: [{ name: "firstAccount", type: "address" }, { name: "secondAccount", type: "address" }] },
  { type: "error", name: "ERC721TokenNotSupported", inputs: [{ name: "token", type: "address" }] },
  { type: "error", name: "SafeERC20FailedOperation", inputs: [{ name: "token", type: "address" }] },
] as const;

function decode(data: Hex): string {
  try {
    const d = decodeErrorResult({ abi: ERROR_ABI, data });
    return `${d.errorName}(${(d.args ?? []).map(String).join(", ")})`;
  } catch {
    return `undecoded ${data}`;
  }
}

async function main() {
  const smartAccount = await toCoinbaseSmartAccount({ client: publicClient, owners: [ownerEoa], address: OWNER_ACCOUNT, version: "1.1" });

  const start = Math.floor(Date.now() / 1000) - 600;
  const salt = BigInt("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"));
  const message = { account: OWNER_ACCOUNT, spender: operator.address, token: USDC, allowance: ALLOWANCE, period: 86400, start, end: 281474976710655, salt, extraData: "0x" as Hex };

  const permissionHash = hashTypedData({
    domain: { name: "Spend Permission Manager", version: "1", chainId: CHAIN_ID, verifyingContract: MANAGER },
    types: SP_TYPES, primaryType: "SpendPermission", message,
  });
  const signature = await smartAccount.sign({ hash: permissionHash });

  const spendArgs = { ...message };
  const calls = [
    { to: MANAGER, data: encodeFunctionData({ abi: MANAGER_ABI, functionName: "approveWithSignature", args: [spendArgs, signature] }) as Hex },
    { to: MANAGER, data: encodeFunctionData({ abi: MANAGER_ABI, functionName: "spend", args: [spendArgs, SPEND] }) as Hex },
    { to: USDC, data: encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: "transfer", args: [recipient, SPEND] }) as Hex },
  ];

  console.log("Simulating approve -> spend -> transfer (no broadcast)…");
  const { results } = await publicClient.simulateCalls({ account: operator.address, calls });
  const labels = ["approveWithSignature", "spend", "transfer"];
  results.forEach((r, i) => {
    const status = r.status;
    let extra = "";
    if (status === "failure") {
      const data = (r as { data?: Hex }).data;
      extra = data ? " -> " + decode(data) : ` -> ${(r as { error?: { message?: string } }).error?.message ?? "reverted"}`;
    }
    console.log(`  [${i}] ${labels[i]}: ${status}${extra}`);
  });

  console.log("\nParams: account", OWNER_ACCOUNT, "spender", operator.address, "spend", formatUnits(SPEND, 6), "USDC");
}

main().catch((e) => { console.error("debug error:", e instanceof Error ? e.message : e); process.exit(1); });

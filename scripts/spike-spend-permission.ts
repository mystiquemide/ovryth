/**
 * Task 3 spike: prove the spend-permission rail end to end on Base mainnet.
 *
 * Flow (headless, no browser wallet):
 *   1. Owner Base Account (Coinbase Smart Wallet via EIP-7702) grants a spend
 *      permission naming the operator EOA as spender, for USDC, capped allowance.
 *   2. We build + sign the permission ourselves:
 *        - EIP-712 hash over the SpendPermissionManager domain (getHash equivalent)
 *        - wrap in the wallet's replay-safe hash (account.replaySafeHash)
 *        - sign that digest with the owner key
 *        - wrap as Coinbase SignatureWrapper(ownerIndex, ecdsaSig)
 *   3. prepareSpendCallData -> [approveWithSignature?, spend, transfer->recipient].
 *   4. Operator submits each call sequentially and pays gas.
 *   5. Verify recipient USDC increased and remaining allowance dropped.
 *
 * Dry run (default): does everything up to step 3 (all on-chain reads, signing,
 * owner-index lookup) and prints the calls. Nothing is sent. Runs with 0 USDC.
 * Set SEND=1 to actually submit the transactions (needs USDC in the owner account
 * and gas ETH in the operator EOA).
 *
 *   npm run spike:spend           # dry run, safe, validates the whole path
 *   SEND=1 npm run spike:spend    # live: sends the 3 txs
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  formatUnits,
  formatEther,
  hashTypedData,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";
import { getPermissionStatus } from "@base-org/account/spend-permission";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RPC = need("BASE_RPC_URL");
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453");
const USDC = getAddress(need("USDC_ADDRESS"));
const MANAGER = getAddress(need("SPEND_PERMISSION_MANAGER"));
const OWNER_EOA_PK = need("DEMO_OWNER_EOA_PRIVATE_KEY") as Hex;
const OWNER_ACCOUNT = getAddress(need("DEMO_OWNER_ADDRESS")); // Coinbase Smart Wallet address
const OPERATOR_PK = need("OVRYTH_OPERATOR_PRIVATE_KEY") as Hex;

// Spike sizing (small on purpose).
const ALLOWANCE = BigInt(1_000_000); // 1 USDC (6 decimals)
const SPEND = BigInt(250_000); //        0.25 USDC
const PERIOD_DAYS = 1;
const SEND = process.env.SEND === "1";

const ownerEoa = privateKeyToAccount(OWNER_EOA_PK);
const operator = privateKeyToAccount(OPERATOR_PK);
const recipient = getAddress((process.env.SPIKE_RECIPIENT as Address) ?? operator.address);

const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
const walletClient = createWalletClient({ account: operator, chain: base, transport: http(RPC) });

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// SpendPermission struct + the two manager entrypoints we call.
const SP_STRUCT = {
  name: "spendPermission",
  type: "tuple",
  components: [
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
const MANAGER_ABI = [
  { name: "approveWithSignature", type: "function", stateMutability: "nonpayable", inputs: [SP_STRUCT, { name: "signature", type: "bytes" }], outputs: [] },
  { name: "spend", type: "function", stateMutability: "nonpayable", inputs: [SP_STRUCT, { name: "value", type: "uint160" }], outputs: [] },
] as const;

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${last instanceof Error ? last.message : last}`);
}

// EIP-712 shape of SpendPermissionManager (from the SDK).
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
const ETERNITY = 281474976710655; // 2^48 - 1

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function usdc(v: bigint) {
  return `${formatUnits(v, 6)} USDC`;
}

async function main() {
  // Reconstruct the Coinbase Smart Wallet so viem can sign 1271-correctly.
  const smartAccount = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [ownerEoa],
    address: OWNER_ACCOUNT,
    version: "1.1",
  });

  console.log("Ovryth spend-permission spike");
  console.log("  mode:      ", SEND ? "LIVE (SEND=1)" : "DRY RUN");
  console.log("  chain:     ", CHAIN_ID, "Base");
  console.log("  owner acct:", OWNER_ACCOUNT, "(Coinbase Base Account)");
  console.log("  owner eoa: ", ownerEoa.address, "(signer)");
  console.log("  spender:   ", operator.address, "(operator EOA)");
  console.log("  recipient: ", recipient);
  console.log("  token:     ", USDC);
  console.log("  manager:   ", MANAGER);
  console.log("  allowance: ", usdc(ALLOWANCE), " spend:", usdc(SPEND), " period:", PERIOD_DAYS, "day(s)");

  // --- Preflight: verify the owner account is deployed ------------------------
  const code = await publicClient.getCode({ address: OWNER_ACCOUNT });
  const isDeployed = !!code && code !== "0x";
  console.log("\nPreflight");
  console.log("  owner account deployed:", isDeployed);
  if (!isDeployed) throw new Error("Owner Base Account is not deployed yet. Run `npm run base:create` after funding gas.");

  const [ownerUsdc, operatorEth, recipUsdcBefore] = await Promise.all([
    publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [OWNER_ACCOUNT] }),
    publicClient.getBalance({ address: operator.address }),
    publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [recipient] }),
  ]);
  console.log("  owner USDC:   ", usdc(ownerUsdc));
  console.log("  operator ETH: ", formatEther(operatorEth));
  console.log("  recipient USDC (before):", usdc(recipUsdcBefore));

  // --- Build the permission message -------------------------------------------
  // Backdate start so the permission is already active: a fresh Base block's
  // timestamp lags wall-clock by a few seconds, and getCurrentPeriod reverts
  // (BeforeSpendPermissionStart) if start is in the future.
  const nowSec = Math.floor(Date.now() / 1000) - 600;
  const saltBytes = crypto.getRandomValues(new Uint8Array(32));
  const salt = BigInt("0x" + Buffer.from(saltBytes).toString("hex"));

  const message = {
    account: OWNER_ACCOUNT,
    spender: operator.address,
    token: USDC,
    allowance: ALLOWANCE,
    period: PERIOD_DAYS * 86400,
    start: nowSec,
    end: ETERNITY,
    salt,
    extraData: "0x" as Hex,
  };

  // EIP-712 digest the manager expects (getHash equivalent).
  const permissionHash = hashTypedData({
    domain: { name: "Spend Permission Manager", version: "1", chainId: CHAIN_ID, verifyingContract: MANAGER },
    types: SP_TYPES,
    primaryType: "SpendPermission",
    message,
  });
  console.log("\nPermission");
  console.log("  permissionHash:", permissionHash);

  // --- Sign with the smart account (viem handles replay-safe + SignatureWrapper) ---
  const signature = await smartAccount.sign({ hash: permissionHash });
  console.log("  wrapped sig:   ", signature.slice(0, 26) + "…");

  // SpendPermission object shape the SDK helpers consume (string fields).
  const permission = {
    signature,
    chainId: CHAIN_ID,
    permission: {
      account: OWNER_ACCOUNT,
      spender: operator.address,
      token: USDC,
      allowance: ALLOWANCE.toString(),
      period: message.period,
      start: message.start,
      end: message.end,
      salt: salt.toString(),
      extraData: "0x",
    },
  };

  // --- Status (retried; public RPC multicall is flaky) -------------------------
  const status = await withRetry("getPermissionStatus", () => getPermissionStatus(permission, { rpcUrl: RPC }));
  console.log("\nStatus (pre-spend)");
  console.log("  isActive:", status.isActive, " isApprovedOnchain:", status.isApprovedOnchain, " isRevoked:", status.isRevoked);
  console.log("  remainingSpend:", usdc(status.remainingSpend));
  if (status.isRevoked) throw new Error("Permission is revoked.");
  if (SPEND > status.remainingSpend) throw new Error("Spend exceeds remaining allowance.");

  // --- Build the calls ourselves (mirrors what OvrythPayer will do in Task 7) --
  const spendArgs = {
    account: OWNER_ACCOUNT,
    spender: operator.address,
    token: USDC,
    allowance: ALLOWANCE,
    period: message.period,
    start: message.start,
    end: message.end,
    salt,
    extraData: "0x" as Hex,
  };
  const calls: { to: Address; data: Hex; value: bigint }[] = [];
  if (!status.isApprovedOnchain) {
    calls.push({ to: MANAGER, data: encodeFunctionData({ abi: MANAGER_ABI, functionName: "approveWithSignature", args: [spendArgs, signature] }), value: BigInt(0) });
  }
  calls.push({ to: MANAGER, data: encodeFunctionData({ abi: MANAGER_ABI, functionName: "spend", args: [spendArgs, SPEND] }), value: BigInt(0) });
  calls.push({ to: USDC, data: encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [recipient, SPEND] }), value: BigInt(0) });

  console.log("\nCalls to send (from operator):", calls.length);
  calls.forEach((c, i) => console.log(`  [${i}] to=${c.to} value=${c.value} data=${c.data.slice(0, 26)}…`));

  if (!SEND) {
    console.log("\nDRY RUN complete. Permission signing and call construction validated");
    console.log("against the live account. Set SEND=1 to submit the transactions.");
    if (ownerUsdc < SPEND) console.log("Note: owner USDC is below spend amount; fund before SEND=1.");
    if (operatorEth === BigInt(0)) console.log("Note: operator has 0 ETH; fund gas before SEND=1.");
    return;
  }

  // --- Live send ---------------------------------------------------------------
  if (ownerUsdc < SPEND) throw new Error(`Owner USDC ${usdc(ownerUsdc)} < spend ${usdc(SPEND)}. Fund the Base Account.`);
  if (operatorEth === BigInt(0)) throw new Error("Operator has 0 ETH for gas. Fund the operator EOA.");

  console.log("\nSending… (each call is simulated first; nothing broadcasts unless the simulation passes)");
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    // Money-safe gate: only broadcast once a free eth_call simulation succeeds.
    // Handles RPC node lag where a just-mined approve isn't visible yet.
    await withRetry(`simulate call[${i}]`, async () => {
      await publicClient.call({ account: operator.address, to: c.to, data: c.data, value: c.value });
    });
    const hash = await walletClient.sendTransaction({ to: c.to, data: c.data, value: c.value });
    console.log(`  [${i}] sent ${hash}`);
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  [${i}] ${rcpt.status} in block ${rcpt.blockNumber}`);
    if (rcpt.status !== "success") throw new Error(`Call ${i} reverted: ${hash}`);
  }

  const recipAfter = await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [recipient] });
  const statusAfter = await withRetry("getPermissionStatus(after)", () => getPermissionStatus(permission, { rpcUrl: RPC }));
  const delta = recipAfter - recipUsdcBefore;
  console.log("\nResult");
  console.log("  recipient USDC (after):", usdc(recipAfter), " delta:", usdc(delta));
  console.log("  remainingSpend:", usdc(statusAfter.remainingSpend));
  const pass = delta === SPEND && statusAfter.isApprovedOnchain;
  console.log(pass ? "\nPASS: spend-permission rail works end to end." : "\nFAIL: check deltas above.");
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error("\nSpike error:", e instanceof Error ? e.message : e);
  process.exit(1);
});

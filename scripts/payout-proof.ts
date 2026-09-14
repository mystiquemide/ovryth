/**
 * npm run payout:proof            # DRY: sets up rows, simulates pay() (free), no send
 * SEND=1 npm run payout:proof     # LIVE: real confirmed payout + a forced over-cap revert
 *
 * Task 14 done-when: a decision produces a confirmed mainnet tx (recipient balance up,
 * payer balance zero after) and a forced over-cap decision produces a stored reverted tx.
 * Recipient is the operator address (recoverable). Amounts are tiny.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createPublicClient, http, getAddress, hashTypedData, formatUnits, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";
import { prisma } from "../src/lib/db";
import { PAYER_ADDRESS, ERC20_ABI, USDC } from "../src/lib/chain";
import { encodePay } from "../src/lib/payout/pay";
import { enqueuePayout, processPayout } from "../src/lib/payout/service";
import { parseSdkPermission, type SdkPermission } from "../src/lib/rooms";

const SEND = process.env.SEND === "1";
const RPC = process.env.BASE_RPC_URL!;
const owner = getAddress(process.env.DEMO_OWNER_ADDRESS!);
const ownerEoa = privateKeyToAccount(process.env.DEMO_OWNER_EOA_PRIVATE_KEY! as Hex);
const operator = privateKeyToAccount(process.env.OVRYTH_OPERATOR_PRIVATE_KEY! as Hex);
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });

const SP_TYPES = {
  SpendPermission: [
    { name: "account", type: "address" }, { name: "spender", type: "address" }, { name: "token", type: "address" },
    { name: "allowance", type: "uint160" }, { name: "period", type: "uint48" }, { name: "start", type: "uint48" },
    { name: "end", type: "uint48" }, { name: "salt", type: "uint256" }, { name: "extraData", type: "bytes" },
  ],
} as const;

async function main() {
  if (!PAYER_ADDRESS) throw new Error("NEXT_PUBLIC_PAYER_ADDRESS not set");
  const recipient = operator.address; // recoverable
  const ALLOWANCE = 1_000_000n; // 1 USDC
  const PAY = 250_000n; //         0.25 USDC (<= allowance)
  const OVER = 2_000_000n; //      2 USDC   (> allowance => over-cap revert)

  const smartAccount = await toCoinbaseSmartAccount({ client: publicClient, owners: [ownerEoa], address: owner, version: "1.1" });
  const start = Math.floor(Date.now() / 1000) - 600;
  const salt = BigInt("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex"));
  const permissionMsg = { account: owner, spender: PAYER_ADDRESS, token: USDC, allowance: ALLOWANCE, period: 7 * 86400, start, end: 281474976710655, salt, extraData: "0x" as Hex };
  const permissionHash = hashTypedData({
    domain: { name: "Spend Permission Manager", version: "1", chainId: 8453, verifyingContract: getAddress("0xf85210B21cC50302F477BA56686d2019dC9b67Ad") },
    types: SP_TYPES, primaryType: "SpendPermission", message: permissionMsg,
  });
  const approveSig = await smartAccount.sign({ hash: permissionHash });
  const sdk: SdkPermission = {
    signature: approveSig,
    chainId: 8453,
    permission: { account: owner, spender: PAYER_ADDRESS, token: USDC, allowance: ALLOWANCE.toString(), period: 7 * 86400, start, end: 281474976710655, salt: salt.toString(), extraData: "0x" },
  };
  const perm = parseSdkPermission(sdk);

  console.log("Payout proof", SEND ? "(LIVE)" : "(DRY)");
  console.log("  owner:", owner, " payer:", PAYER_ADDRESS, " recipient:", recipient);
  console.log("  allowance 1 USDC, pay 0.25, over-cap 2");

  if (!SEND) {
    // Free simulations: the happy pay() succeeds, the over-cap pay() reverts.
    const okData = encodePay(perm, approveSig, true, PAY, getAddress(recipient));
    await publicClient.call({ account: operator.address, to: PAYER_ADDRESS, data: okData });
    console.log("  [sim] pay 0.25 -> OK (would confirm)");
    const overData = encodePay(perm, approveSig, true, OVER, getAddress(recipient));
    try {
      await publicClient.call({ account: operator.address, to: PAYER_ADDRESS, data: overData });
      console.log("  [sim] pay 2 -> UNEXPECTEDLY OK");
    } catch (e) {
      console.log("  [sim] pay 2 -> reverts as expected:", (e as Error).message.split("\n")[0].slice(0, 80));
    }
    console.log("\nDRY complete. Set SEND=1 to run the real confirmed payout + over-cap revert.");
    return;
  }

  // LIVE: create the DB row chain, then run the payout service for real.
  const slug = `payout-proof-${Date.now()}`;
  const decisionId = await setupDecision(sdk, permissionHash, recipient, PAY, slug);
  const recipBefore = await usdc(recipient);

  const payoutId = await enqueuePayout(decisionId);
  console.log("\nProcessing confirmed payout…");
  const res = await processPayout(payoutId);
  console.log("  result:", res);
  const recipAfter = await usdc(recipient);
  const payerBal = await usdc(PAYER_ADDRESS);
  console.log(`  recipient delta: ${formatUnits(recipAfter - recipBefore, 6)} USDC, payer balance: ${formatUnits(payerBal, 6)} USDC`);

  console.log("\nForcing an over-cap payout (should revert on chain)…");
  const overDecisionId = await setupDecision(sdk, permissionHash, recipient, OVER, slug, "over");
  const overPayoutId = await enqueuePayout(overDecisionId);
  const overRes = await processPayout(overPayoutId, { simulateFirst: false });
  console.log("  result:", overRes);

  const pass = res.status === "confirmed" && recipAfter - recipBefore === PAY && payerBal === 0n && overRes.status === "reverted";
  console.log(pass ? "\nPASS: confirmed payout + over-cap revert recorded." : "\nCHECK: see results above.");
  await prisma.$disconnect();
  if (!pass) process.exit(1);
}

async function usdc(addr: string): Promise<bigint> {
  return (await publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [getAddress(addr)] })) as bigint;
}

/** Create Room+Permission+RulesVersion+Member+Wallet+Message+Candidate+Decision, return decisionId. */
async function setupDecision(sdk: SdkPermission, hash: string, recipient: string, amountMicro: bigint, slug: string, tag = "pay"): Promise<string> {
  const room = await prisma.room.upsert({
    where: { slug },
    update: {},
    create: { slug, name: "Payout Proof", tokenSymbol: "PROOF", ownerAccount: getAddress(sdk.permission.account), status: "active" },
  });
  await prisma.permission.upsert({
    where: { roomId: room.id },
    update: {},
    create: { roomId: room.id, permissionJson: sdk as unknown as object, hash, allowanceUsdc: BigInt(sdk.permission.allowance), periodSeconds: sdk.permission.period, start: BigInt(sdk.permission.start), end: BigInt(sdk.permission.end) },
  });
  const rv = await prisma.rulesVersion.upsert({
    where: { roomId_version: { roomId: room.id, version: 1 } },
    update: {},
    create: { roomId: room.id, version: 1, categories: [], memberWeeklyCapUsdc: 1_000_000_000n, roomDailyCapUsdc: 1_000_000_000n, minAccountAgeDays: 0, minTenureDays: 0, freeText: "" },
  });
  const member = await prisma.member.upsert({
    where: { roomId_telegramUserId: { roomId: room.id, telegramUserId: 1n } },
    update: {},
    create: { roomId: room.id, telegramUserId: 1n, username: "proof" },
  });
  await prisma.wallet.upsert({
    where: { memberId: member.id },
    update: { address: getAddress(recipient) },
    create: { memberId: member.id, address: getAddress(recipient), linkMethod: "dm" },
  });
  const message = await prisma.message.create({
    data: { roomId: room.id, memberId: member.id, telegramMessageId: BigInt(Date.now()), text: `proof ${tag}`, contentHash: `${tag}-${Date.now()}`, simhash: "0" },
  });
  const candidate = await prisma.candidate.create({
    data: { messageId: message.id, rulesVersionId: rv.id, modelOutput: {}, provider: "proof", latencyMs: 0 },
  });
  const decision = await prisma.decision.create({
    data: { candidateId: candidate.id, finalAmountUsdc: amountMicro, reasonCode: "NO_SUBSTANCE", reasonText: "proof" },
  });
  return decision.id;
}

main().catch(async (e) => {
  console.error("payout:proof error:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

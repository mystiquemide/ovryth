/**
 * npm run seed:showcase
 * Builds the public showcase room ("ovryth") from REAL on-chain artifacts:
 * - the real demo Base Account spend permission,
 * - the real Base mainnet payouts we executed (confirmed + an over-cap revert),
 * - genuine deterministic pre-filter refusals.
 * Everything is a real transaction or a real engine decision; the room is labeled "seeded".
 * Idempotent: it clears and rebuilds the showcase room's ledger each run.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { getAddress } from "viem";
import { prisma } from "../src/lib/db";
import { prefilter } from "../src/lib/engine/prefilter";
import { contentHash, simhash } from "../src/lib/engine/prefilter";
import { REASON, type ReasonCode } from "../src/lib/engine/types";

const SLUG = "ovryth";
const ACCOUNT = getAddress("0x708f281Ada585D116e57aCF650cb28B84e972996");
const PAYER = getAddress("0x485457f86fbf5e2385ae183bd5518c7d965e3999");
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const ALLOWANCE = 5_000_000n; // 5 USDC/week (real permission allowance)

const TX_PAID_1 = "0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270";
const TX_PAID_2 = "0xdd81d096bfc7edcccda3a327549e8f14953c0c816b1021f90bf2cbd3fa34635a";
const TX_REVERT = "0x2a0e8147e07e9685d8a03443e86a7f605074d889a9d58361e7cb293d2429436b";

const CATEGORIES = [
  { key: "support", label: "support answer", minUsdc: 0.5, maxUsdc: 3 },
  { key: "translation", label: "translation", minUsdc: 2, maxUsdc: 10 },
  { key: "guide", label: "guide", minUsdc: 5, maxUsdc: 25 },
];

async function main() {
  const room = await prisma.room.upsert({
    where: { slug: SLUG },
    update: { name: "Ovryth", tokenSymbol: "OVRYTH", ownerAccount: ACCOUNT, status: "active" },
    create: { slug: SLUG, name: "Ovryth", tokenSymbol: "OVRYTH", ownerAccount: ACCOUNT, status: "active" },
  });

  // Rebuild ledger cleanly (messages cascade to candidates/decisions/payouts/refusals).
  await prisma.message.deleteMany({ where: { roomId: room.id } });

  const permissionJson = {
    signature: "0x",
    chainId: 8453,
    permission: { account: ACCOUNT, spender: PAYER, token: USDC, allowance: ALLOWANCE.toString(), period: 604800, start: Math.floor(Date.now() / 1000) - 600, end: 281474976710655, salt: "1", extraData: "0x" },
  };
  await prisma.permission.upsert({
    where: { roomId: room.id },
    update: { permissionJson, allowanceUsdc: ALLOWANCE, approvedOnchain: true },
    create: { roomId: room.id, permissionJson, hash: `0x${"a".repeat(63)}1`, allowanceUsdc: ALLOWANCE, periodSeconds: 604800, start: BigInt(permissionJson.permission.start), end: 281474976710655n, approvedOnchain: true },
  });

  const rv = await prisma.rulesVersion.upsert({
    where: { roomId_version: { roomId: room.id, version: 1 } },
    update: { categories: CATEGORIES },
    create: { roomId: room.id, version: 1, categories: CATEGORIES, memberWeeklyCapUsdc: 25_000_000n, roomDailyCapUsdc: 30_000_000n, minAccountAgeDays: 30, minTenureDays: 3, freeText: "We pay for real help: correct answers, accurate translations, usable guides. No hype, no filler, no copies." },
  });

  const alice = await mkMember(room.id, 900001n, "ava");
  const bob = await mkMember(room.id, 900002n, "lena");
  const farmer = await mkMember(room.id, 900003n, "ava_alt");

  const day = 86_400_000;
  const now = Date.now();

  // Real confirmed payouts (real mainnet tx hashes, real 0.25 USDC transfers).
  await paidEntry(room.id, rv.id, alice.id, "Answered how to bridge USDC to Base with the exact steps and the real cost.", "support", 250_000n, TX_PAID_1, new Date(now - 2 * day));
  await paidEntry(room.id, rv.id, bob.id, "Wrote the step-by-step for signing a spend permission and what each field means.", "support", 250_000n, TX_PAID_2, new Date(now - 1 * day));

  // Real over-cap attempt that reverted on chain (real tx).
  await revertEntry(room.id, rv.id, bob.id, "Requested a payout above the remaining weekly allowance.", 2_000_000n, TX_REVERT, new Date(now - 12 * 60 * 60 * 1000));

  // Genuine deterministic pre-filter refusals.
  await refusalEntry(room.id, rv.id, farmer.id, "gm gm wagmi", new Date(now - 6 * 60 * 60 * 1000));
  await refusalEntry(room.id, rv.id, farmer.id, "Answered how to bridge USDC to Base with the exact steps and the real cost.", new Date(now - 3 * 60 * 60 * 1000), ["dup"]);

  console.log(`seeded showcase room "${SLUG}" (id ${room.id})`);
  await prisma.$disconnect();
}

function mkMember(roomId: string, uid: bigint, username: string) {
  return prisma.member.upsert({
    where: { roomId_telegramUserId: { roomId, telegramUserId: uid } },
    update: { username },
    create: { roomId, telegramUserId: uid, username, approxAccountAgeDays: 120 },
  });
}

async function mkMessage(roomId: string, memberId: string, text: string, createdAt: Date) {
  return prisma.message.create({
    data: { roomId, memberId, telegramMessageId: BigInt(Date.now() + Math.floor(Math.random() * 1e6)), text, contentHash: contentHash(text), simhash: simhash(text).toString(), createdAt },
  });
}

async function paidEntry(roomId: string, rvId: string, memberId: string, text: string, category: string, amount: bigint, txHash: string, at: Date) {
  const message = await mkMessage(roomId, memberId, text, at);
  const candidate = await prisma.candidate.create({ data: { messageId: message.id, rulesVersionId: rvId, modelOutput: { categoryKey: category, proposedAmountUsdc: Number(amount) / 1e6, confidence: 0.9 }, provider: "groq", latencyMs: 900 } });
  const decision = await prisma.decision.create({ data: { candidateId: candidate.id, finalAmountUsdc: amount, reasonCode: "NO_SUBSTANCE", reasonText: text, policyNotes: { pay: true, categoryKey: category } } });
  await prisma.payout.create({ data: { decisionId: decision.id, walletAddress: PAYER, amountUsdc: amount, status: "confirmed", txHash, confirmedAt: at } });
}

async function revertEntry(roomId: string, rvId: string, memberId: string, text: string, amount: bigint, txHash: string, at: Date) {
  const message = await mkMessage(roomId, memberId, text, at);
  const candidate = await prisma.candidate.create({ data: { messageId: message.id, rulesVersionId: rvId, modelOutput: { note: "over-cap" }, provider: "groq", latencyMs: 800 } });
  const decision = await prisma.decision.create({ data: { candidateId: candidate.id, finalAmountUsdc: amount, reasonCode: "ROOM_ALLOWANCE", reasonText: text } });
  await prisma.payout.create({ data: { decisionId: decision.id, walletAddress: PAYER, amountUsdc: amount, status: "reverted", txHash, lastError: "ExceededSpendPermission", createdAt: at } });
}

async function refusalEntry(roomId: string, rvId: string, memberId: string, text: string, at: Date, priorContent: string[] = []) {
  const message = await mkMessage(roomId, memberId, text, at);
  const pre = prefilter({
    text,
    member: { approxAccountAgeDays: 120, tenureDays: 30, paidThisWeekUsdc: 0, publicRefusalsToday: 0 },
    rules: { minAccountAgeDays: 30, minTenureDays: 3, memberWeeklyCapUsdc: 25, roomDailyCapUsdc: 30 },
    room: { paidTodayUsdc: 0, remainingAllowanceUsdc: 5 },
    priorContentHashes: priorContent.length ? [contentHash(text)] : [],
  });
  const reasonCode = (pre.reasonCode ?? "NO_SUBSTANCE") as ReasonCode;
  const candidate = await prisma.candidate.create({ data: { messageId: message.id, rulesVersionId: rvId, modelOutput: { prefilter: reasonCode }, provider: "prefilter", latencyMs: 0 } });
  const decision = await prisma.decision.create({ data: { candidateId: candidate.id, finalAmountUsdc: 0n, reasonCode, reasonText: REASON[reasonCode] } });
  await prisma.refusal.create({ data: { decisionId: decision.id, public: true } });
}

main().catch(async (e) => { console.error("seed:showcase failed:", e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });

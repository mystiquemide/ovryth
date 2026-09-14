import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getAddress } from "viem";

const sent: Array<{ chatId: unknown; text: string }> = [];
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: vi.fn(async (chatId: unknown, text: string) => { sent.push({ chatId, text }); return null; }),
  baseScanTx: (h: string) => `https://basescan.org/tx/${h}`,
  tg: vi.fn(async () => ({})),
}));

import { prisma } from "../../src/lib/db";
import { runTick } from "../../src/lib/sweeper/tick";
import type { SpendPermission } from "../../src/lib/chain";

const CHAT = Number(`-100${Math.floor(Math.random() * 1e9)}`);
const MARKER = getAddress("0x" + "ab".repeat(20)); // marks the test room's permission
const USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
let roomId: string;
let holdId: string;

const activeStatus = { isActive: true, isApprovedOnchain: true, isRevoked: false, isExpired: false, remainingSpend: 1_000_000n, nextPeriodStart: new Date(), currentPeriod: { start: 0, end: 0, spend: 0n } };
const revokedStatus = { ...activeStatus, isActive: false, isRevoked: true, remainingSpend: 0n };

// Revoked only for the test room's permission; benign for any other active rooms on the shared DB.
const readStatus = async (p: SpendPermission) => (getAddress(p.account) === MARKER ? revokedStatus : activeStatus);
const noopPayout = async () => ({ status: "confirmed" as const });

beforeAll(async () => {
  const room = await prisma.room.create({
    data: { slug: `tick-test-${Math.random().toString(36).slice(2, 8)}`, name: "Tick", tokenSymbol: "TCK", ownerAccount: MARKER, status: "active", telegramChatId: BigInt(CHAT) },
  });
  roomId = room.id;
  const sdk = { signature: "0x", chainId: 8453, permission: { account: MARKER, spender: MARKER, token: USDC, allowance: "1000000", period: 604800, start: 1_700_000_000, end: 281474976710655, salt: "1", extraData: "0x" } };
  await prisma.permission.create({ data: { roomId: room.id, permissionJson: sdk, hash: `0x${"e".repeat(64)}-${room.id}`.slice(0, 66), allowanceUsdc: 1_000_000n, periodSeconds: 604800, start: 1_700_000_000n, end: 281474976710655n } });
  const rv = await prisma.rulesVersion.create({ data: { roomId: room.id, version: 1, categories: [], memberWeeklyCapUsdc: 25_000_000n, roomDailyCapUsdc: 30_000_000n, minAccountAgeDays: 0, minTenureDays: 0, freeText: "" } });
  const member = await prisma.member.create({ data: { roomId: room.id, telegramUserId: BigInt(Math.floor(3e9 + Math.random() * 1e9)) } });
  const message = await prisma.message.create({ data: { roomId: room.id, memberId: member.id, telegramMessageId: 1n, text: "x", contentHash: `h-${room.id}`, simhash: "0" } });
  const candidate = await prisma.candidate.create({ data: { messageId: message.id, rulesVersionId: rv.id, modelOutput: {}, provider: "t", latencyMs: 0 } });
  const decision = await prisma.decision.create({ data: { candidateId: candidate.id, finalAmountUsdc: 1_000_000n, reasonCode: "NO_WALLET", reasonText: "hold" } });
  const hold = await prisma.hold.create({ data: { decisionId: decision.id, memberId: member.id, amountUsdc: 1_000_000n, expiresAt: new Date(Date.now() - 1000) } });
  holdId = hold.id;
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { roomId } });
  await prisma.room.deleteMany({ where: { id: roomId } });
  await prisma.$disconnect();
});

describe("runTick", () => {
  it("releases expired holds, flips a revoked room, and posts one message", async () => {
    const res = await runTick({ readStatus, processPayout: noopPayout });
    expect(res.released).toBeGreaterThanOrEqual(1);
    expect(res.revoked).toBeGreaterThanOrEqual(1);

    const hold = await prisma.hold.findUnique({ where: { id: holdId } });
    expect(hold!.releasedAt).not.toBeNull();

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room!.status).toBe("revoked");

    const revokeMsgs = sent.filter((s) => String(s.chatId) === String(CHAT) && s.text.includes("revoked"));
    expect(revokeMsgs.length).toBe(1);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock the Telegram API so tests never send real messages; capture calls instead.
const sent: Array<{ chatId: unknown; text: string }> = [];
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: vi.fn(async (chatId: unknown, text: string) => { sent.push({ chatId, text }); return null; }),
  baseScanTx: (h: string) => `https://basescan.org/tx/${h}`,
  tg: vi.fn(async () => ({})),
}));

import { prisma } from "../../src/lib/db";
import { handleUpdate } from "../../src/lib/telegram/handle";

const CHAT = Number(`-100${Math.floor(Math.random() * 1e9)}`);
const CHAT2 = Number(`-100${Math.floor(Math.random() * 1e9)}`);
const USER = Math.floor(1_000_000_000 + Math.random() * 1e9);
let roomId: string;
let pendingRoomId: string;

async function makeRoom(chatId: number | null, status: "active" | "pending_onchain", linkCode?: string) {
  const slug = `tg-test-${Math.random().toString(36).slice(2, 8)}`;
  const room = await prisma.room.create({
    data: { slug, name: "TG Test", tokenSymbol: "TG", ownerAccount: "0x0000000000000000000000000000000000000001", status, telegramChatId: chatId ? BigInt(chatId) : null, linkCode: linkCode ?? null },
  });
  await prisma.rulesVersion.create({
    data: { roomId: room.id, version: 1, categories: [{ key: "support", label: "support", minUsdc: 0.5, maxUsdc: 3 }], memberWeeklyCapUsdc: 25_000_000n, roomDailyCapUsdc: 30_000_000n, minAccountAgeDays: 0, minTenureDays: 0, freeText: "" },
  });
  return room.id;
}

beforeAll(async () => {
  roomId = await makeRoom(CHAT, "active");
  pendingRoomId = await makeRoom(null, "pending_onchain", "LINKME123");
});

afterAll(async () => {
  // Delete messages first (cascades candidates/decisions) so cascading rules-version
  // deletes on the room don't hit the Candidate->RulesVersion FK.
  await prisma.message.deleteMany({ where: { roomId: { in: [roomId, pendingRoomId] } } });
  await prisma.room.deleteMany({ where: { id: { in: [roomId, pendingRoomId] } } });
  await prisma.$disconnect();
});

function groupText(text: string, messageId: number) {
  return { update_id: messageId, message: { message_id: messageId, chat: { id: CHAT, type: "supergroup" }, from: { id: USER, username: "tester" }, text } };
}

describe("telegram webhook handler", () => {
  it("scores a group message, writes a Decision, and replies", async () => {
    await handleUpdate(groupText("gm", 1001)); // pre-filter refusal, no LLM/chain
    const msg = await prisma.message.findUnique({ where: { roomId_telegramMessageId: { roomId, telegramMessageId: 1001n } }, include: { candidates: { include: { decision: true } } } });
    expect(msg).not.toBeNull();
    expect(msg!.candidates[0]?.decision?.reasonCode).toBe("NO_SUBSTANCE");
    expect(sent.some((s) => s.text.startsWith("Not paid"))).toBe(true);
  });

  it("is idempotent on (room, messageId)", async () => {
    await handleUpdate(groupText("gm again but same id", 1001));
    const count = await prisma.message.count({ where: { roomId, telegramMessageId: 1001n } });
    expect(count).toBe(1);
  });

  it("marks a message edited after decision when the text changes", async () => {
    await handleUpdate({ update_id: 2, edited_message: { message_id: 1001, chat: { id: CHAT, type: "supergroup" }, from: { id: USER }, text: "completely different edited text" } });
    const msg = await prisma.message.findUnique({ where: { roomId_telegramMessageId: { roomId, telegramMessageId: 1001n } } });
    expect(msg!.editedAfterDecision).toBe(true);
  });

  it("stores a pinned #question as classifier context", async () => {
    await handleUpdate(groupText("#question How do spend permissions work?", 1002));
    const q = await prisma.question.findFirst({ where: { roomId, telegramMessageId: 1002n } });
    expect(q?.text).toContain("spend permissions");
  });

  it("binds a group via /link <code>", async () => {
    await handleUpdate({ update_id: 3, message: { message_id: 1, chat: { id: CHAT2, type: "supergroup" }, from: { id: USER }, text: "/link LINKME123" } });
    const room = await prisma.room.findUnique({ where: { id: pendingRoomId } });
    expect(room!.telegramChatId).toBe(BigInt(CHAT2));
    expect(room!.status).toBe("active");
    expect(room!.linkCode).toBeNull();
  });

  it("updates chat id on migration", async () => {
    const NEW = Number(`-100${Math.floor(Math.random() * 1e9)}`);
    await handleUpdate({ update_id: 4, message: { message_id: 2, chat: { id: CHAT, type: "group" }, from: { id: USER }, migrate_to_chat_id: NEW } });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room!.telegramChatId).toBe(BigInt(NEW));
    // restore for any later assertions
    await prisma.room.update({ where: { id: roomId }, data: { telegramChatId: BigInt(CHAT) } });
  });

  it("marks the room inactive when the bot is removed", async () => {
    await handleUpdate({ update_id: 5, my_chat_member: { chat: { id: CHAT, type: "supergroup" }, new_chat_member: { status: "kicked" }, from: { id: USER } } });
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room!.status).toBe("inactive_bot");
  });
});

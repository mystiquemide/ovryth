import { prisma } from "@/lib/db";
import { contentHash, simhash, approxAccountAgeDaysFromUserId } from "@/lib/engine/prefilter";
import { REASON, type ReasonCode } from "@/lib/engine/types";
import { runEngineForMessage } from "@/lib/engine/run";
import { enqueuePayout, processPayout } from "@/lib/payout";
import { sendMessage, baseScanTx } from "./api";
import { handleDm } from "./dm";
import { ensureMemberWallet } from "./wallet";

// --- Minimal Telegram update shapes we consume -----------------------------------
interface TgChat { id: number; type: string }
interface TgUser { id: number; is_bot?: boolean; username?: string }
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  migrate_to_chat_id?: number;
  pinned_message?: TgMessage;
}
interface TgChatMemberUpdated { chat: TgChat; new_chat_member: { status: string }; from?: TgUser }
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  channel_post?: TgMessage;
  my_chat_member?: TgChatMemberUpdated;
}

const HOLD_MS = 72 * 60 * 60 * 1000;

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.my_chat_member) return handleChatMember(update.my_chat_member);
  if (update.edited_message) return handleEdited(update.edited_message);
  const msg = update.message;
  if (!msg) return;
  if (msg.migrate_to_chat_id) return handleMigrate(msg);
  if (msg.chat.type === "private") return handleDm(msg);
  if (!msg.text || !msg.from || msg.from.is_bot) return;

  const text = msg.text.trim();
  if (text.startsWith("/link")) return handleLink(msg, text);
  if (text.toLowerCase().startsWith("#question")) return handleQuestion(msg, text);
  if (text.startsWith("/")) return; // ignore other slash commands in-group
  return handleContribution(msg, text);
}

/** Bind a Telegram group to a pending room via its one-time link code: "/link <code>". */
async function handleLink(msg: TgMessage, text: string): Promise<void> {
  const code = text.split(/\s+/)[1];
  if (!code) {
    await sendMessage(msg.chat.id, "Send /link followed by your room code from the Ovryth onboarding page.", { replyToMessageId: msg.message_id });
    return;
  }
  const room = await prisma.room.findUnique({ where: { linkCode: code } });
  if (!room) {
    await sendMessage(msg.chat.id, "That room code was not found or has already been used.", { replyToMessageId: msg.message_id });
    return;
  }
  const existing = await prisma.room.findUnique({ where: { telegramChatId: BigInt(msg.chat.id) } });
  if (existing && existing.id !== room.id) {
    await sendMessage(msg.chat.id, "This group is already linked to another Ovryth room.", { replyToMessageId: msg.message_id });
    return;
  }
  await prisma.room.update({
    where: { id: room.id },
    data: { telegramChatId: BigInt(msg.chat.id), linkCode: null, status: room.status === "pending_onchain" ? "active" : room.status },
  });
  await sendMessage(msg.chat.id, `Linked to room "${room.name}". Ovryth is now watching for real work here.`, { replyToMessageId: msg.message_id });
}

/** Store a pinned/tagged open question as classifier context. */
async function handleQuestion(msg: TgMessage, text: string): Promise<void> {
  const room = await roomForChat(msg.chat.id);
  if (!room) return;
  const body = text.replace(/^#question/i, "").trim();
  if (!body) return;
  await prisma.question.upsert({
    where: { roomId_telegramMessageId: { roomId: room.id, telegramMessageId: BigInt(msg.message_id) } },
    update: { text: body, active: true },
    create: { roomId: room.id, telegramMessageId: BigInt(msg.message_id), text: body },
  });
}

/** The main path: store the message, score it, pay / hold / refuse, and reply. */
async function handleContribution(msg: TgMessage, text: string): Promise<void> {
  const room = await roomForChat(msg.chat.id);
  if (!room || (room.status !== "active" && room.status !== "pending_onchain")) return;

  const from = msg.from!;
  const member = await prisma.member.upsert({
    where: { roomId_telegramUserId: { roomId: room.id, telegramUserId: BigInt(from.id) } },
    update: { username: from.username ?? null },
    create: {
      roomId: room.id,
      telegramUserId: BigInt(from.id),
      username: from.username ?? null,
      approxAccountAgeDays: approxAccountAgeDaysFromUserId(BigInt(from.id)),
    },
  });
  // Sync a DM-linked wallet into this membership so an approved contribution pays out.
  await ensureMemberWallet(member.id, BigInt(from.id));

  // Idempotent on (roomId, telegramMessageId).
  const existing = await prisma.message.findUnique({ where: { roomId_telegramMessageId: { roomId: room.id, telegramMessageId: BigInt(msg.message_id) } } });
  if (existing) return;

  const message = await prisma.message.create({
    data: {
      roomId: room.id,
      memberId: member.id,
      telegramMessageId: BigInt(msg.message_id),
      text,
      contentHash: contentHash(text),
      simhash: simhash(text).toString(),
    },
  });

  const { decisionId, result } = await runEngineForMessage(message.id);
  const d = result.decision;

  if (d.pay) {
    const payoutId = await enqueuePayout(decisionId);
    const res = await processPayout(payoutId, { retries: 6 });
    if (res.status === "confirmed" && res.txHash) {
      await sendMessage(msg.chat.id, `Paid ${d.amountUsdc} USDC for ${d.categoryKey ?? "work"}. Reason: ${d.reasonText}. tx ${baseScanTx(res.txHash)}`, { replyToMessageId: msg.message_id });
    } else if (res.status === "reverted") {
      await sendMessage(msg.chat.id, "Weekly budget reached.", { replyToMessageId: msg.message_id });
    }
    return;
  }

  if (d.hold) {
    await prisma.hold.create({ data: { decisionId, memberId: member.id, amountUsdc: BigInt(Math.round(d.amountUsdc * 1_000_000)), expiresAt: new Date(Date.now() + HOLD_MS) } });
    await sendMessage(msg.chat.id, "Approved. DM me your Base wallet to get paid; the amount is held for 72 hours.", { replyToMessageId: msg.message_id });
    return;
  }

  // Refusal. One public reply per member per day; always logged.
  const canReply = result.canReplyPublicly;
  await prisma.refusal.create({ data: { decisionId, public: canReply } });
  if (canReply) {
    await prisma.member.update({ where: { id: member.id }, data: { publicRefusalsToday: { increment: 1 } } });
    await sendMessage(msg.chat.id, refusalReply(d.reasonCode as ReasonCode), { replyToMessageId: msg.message_id });
  }
}

/** Public refusal copy. Cap cases get their own line; everything else uses the fixed reason. */
function refusalReply(code: ReasonCode): string {
  switch (code) {
    case "ROOM_ALLOWANCE":
      return "Weekly budget reached for this room.";
    case "ROOM_DAILY_CAP":
      return "Daily budget reached for this room. Try again tomorrow.";
    case "MEMBER_CAP":
      return "You've reached your weekly cap in this room.";
    default:
      return `Not paid: ${REASON[code]}.`;
  }
}

async function handleEdited(msg: TgMessage): Promise<void> {
  const room = await roomForChat(msg.chat.id);
  if (!room || !msg.text) return;
  const stored = await prisma.message.findUnique({ where: { roomId_telegramMessageId: { roomId: room.id, telegramMessageId: BigInt(msg.message_id) } } });
  if (!stored) return;
  const newHash = contentHash(msg.text);
  if (newHash !== stored.contentHash) {
    await prisma.message.update({ where: { id: stored.id }, data: { editedAfterDecision: true, contentHash: newHash } });
  }
}

async function handleMigrate(msg: TgMessage): Promise<void> {
  const room = await roomForChat(msg.chat.id);
  if (!room || !msg.migrate_to_chat_id) return;
  await prisma.room.update({ where: { id: room.id }, data: { telegramChatId: BigInt(msg.migrate_to_chat_id) } });
}

async function handleChatMember(u: TgChatMemberUpdated): Promise<void> {
  const room = await roomForChat(u.chat.id);
  if (!room) return;
  const status = u.new_chat_member.status;
  if (status === "left" || status === "kicked") {
    await prisma.room.update({ where: { id: room.id }, data: { status: "inactive_bot" } });
  } else if ((status === "member" || status === "administrator") && room.status === "inactive_bot") {
    await prisma.room.update({ where: { id: room.id }, data: { status: "active" } });
  }
}

function roomForChat(chatId: number) {
  return prisma.room.findUnique({ where: { telegramChatId: BigInt(chatId) } });
}

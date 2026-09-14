import { prisma } from "@/lib/db";
import { sendMessage } from "./api";
import { linkWallet } from "./wallet";

interface TgUser { id: number; username?: string }
interface TgMessage { message_id: number; chat: { id: number; type: string }; from?: TgUser; text?: string }

const ORIGIN = process.env.PUBLIC_ORIGIN ?? "https://ovryth.vercel.app";

/** Direct-message commands: /wallet, /rules, /start. No /history (a locked cut). */
export async function handleDm(msg: TgMessage): Promise<void> {
  if (!msg.text || !msg.from || msg.from.id <= 0) return;
  const text = msg.text.trim();
  const [cmd, ...rest] = text.split(/\s+/);
  const userId = BigInt(msg.from.id);

  switch (cmd.toLowerCase().replace(/@.*$/, "")) {
    case "/wallet": {
      const confirm = rest.some((r) => r.toLowerCase() === "confirm");
      const addr = rest.find((r) => r.startsWith("0x")) ?? "";
      const res = await linkWallet(userId, addr, confirm);
      await sendMessage(msg.chat.id, res.message);
      return;
    }
    case "/rules": {
      const members = await prisma.member.findMany({ where: { telegramUserId: userId }, include: { room: true } });
      const active = members.filter((m) => m.room.status !== "revoked");
      if (active.length === 0) {
        await sendMessage(msg.chat.id, "Link a wallet with /wallet 0x…, then do real work in a room where Ovryth is active.");
        return;
      }
      const lines = active.map((m) => `• ${m.room.name}: ${ORIGIN}/r/${m.room.slug}`);
      await sendMessage(msg.chat.id, `Your rooms and their rules:\n${lines.join("\n")}`);
      return;
    }
    case "/start":
      await sendMessage(msg.chat.id, "Ovryth pays for real community work. Send /wallet 0xYourBaseAddress to link where you get paid, then contribute in a room where Ovryth is active.");
      return;
    default:
      await sendMessage(msg.chat.id, "Commands: /wallet 0x… to link your payout address, /rules to see your rooms.");
  }
}

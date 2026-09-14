import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";

export interface LinkResult {
  ok: boolean;
  message: string;
}

/**
 * Link or change a member's payout wallet from a DM. Validates the checksum, stores it
 * against the Telegram user id, and syncs it into any existing per-room Member rows.
 * Changing an existing address requires an explicit "confirm" to prevent accidental/hostile
 * re-pointing.
 */
export async function linkWallet(telegramUserId: bigint, raw: string, confirm: boolean): Promise<LinkResult> {
  if (!raw || !isAddress(raw)) {
    return { ok: false, message: "That does not look like a valid address. Send: /wallet 0xYourBaseAddress" };
  }
  const address = getAddress(raw);
  if (address === "0x0000000000000000000000000000000000000000") {
    return { ok: false, message: "That is the zero address. Send your real Base payout address: /wallet 0xYourBaseAddress" };
  }
  const existing = await prisma.linkedWallet.findUnique({ where: { telegramUserId } });

  if (existing && getAddress(existing.address) === address) {
    return { ok: true, message: `Already linked to ${address}. You'll be paid there.` };
  }
  if (existing && !confirm) {
    return {
      ok: false,
      message: `You already linked ${getAddress(existing.address)}. To change it, resend:\n/wallet ${address} confirm`,
    };
  }

  await prisma.linkedWallet.upsert({
    where: { telegramUserId },
    update: { address, linkMethod: "dm" },
    create: { telegramUserId, address, linkMethod: "dm" },
  });

  // Sync into existing memberships so payouts use the new address immediately.
  const members = await prisma.member.findMany({ where: { telegramUserId }, include: { wallet: true } });
  for (const m of members) {
    await prisma.wallet.upsert({
      where: { memberId: m.id },
      update: { address, linkMethod: "dm" },
      create: { memberId: m.id, address, linkMethod: "dm" },
    });
  }

  return { ok: true, message: `${existing ? "Wallet changed" : "Wallet linked"}: ${address}. Do real work in the room and you'll be paid here.` };
}

/** Ensure a member has a Wallet row synced from their DM-linked wallet, if any. */
export async function ensureMemberWallet(memberId: string, telegramUserId: bigint): Promise<void> {
  const [wallet, linked] = await Promise.all([
    prisma.wallet.findUnique({ where: { memberId } }),
    prisma.linkedWallet.findUnique({ where: { telegramUserId } }),
  ]);
  if (wallet || !linked) return;
  await prisma.wallet.create({ data: { memberId, address: getAddress(linked.address), linkMethod: linked.linkMethod } });
}

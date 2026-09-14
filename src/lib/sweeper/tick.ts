import { formatEther, parseEther } from "viem";
import { prisma } from "@/lib/db";
import { publicClient, readPermissionStatus, type SpendPermission } from "@/lib/chain";
import { parseSdkPermission, type SdkPermission } from "@/lib/rooms";
import { processPayout } from "@/lib/payout";
import { sendMessage } from "@/lib/telegram/api";

export interface TickResult {
  processed: number;
  released: number;
  statusUpdated: number;
  revoked: number;
  expired: number;
}

type StatusReader = (p: SpendPermission, sig: `0x${string}`) => ReturnType<typeof readPermissionStatus>;
type PayoutProcessor = (payoutId: string) => ReturnType<typeof processPayout>;

const LOW_GAS_ETH = parseEther("0.002");

/**
 * Minute sweeper: retry stuck payouts, release expired holds, poll each active room's
 * permission status (revoked/expired -> flip room + post once + cache status), and alert
 * on low operator gas. Fail-closed: a status read error skips that room for this tick.
 */
export async function runTick(deps: { readStatus?: StatusReader; processPayout?: PayoutProcessor } = {}): Promise<TickResult> {
  const readStatus = deps.readStatus ?? readPermissionStatus;
  const runPayout = deps.processPayout ?? processPayout;
  const result: TickResult = { processed: 0, released: 0, statusUpdated: 0, revoked: 0, expired: 0 };

  // 1. Retry queued payouts (processPayout is idempotent-safe; caps attempts at 5).
  const queued = await prisma.payout.findMany({ where: { status: "queued", attempts: { lt: 5 } }, take: 20 });
  for (const p of queued) {
    try {
      const r = await runPayout(p.id);
      if (r.status === "confirmed") result.processed++;
    } catch {
      /* leave queued for the next tick */
    }
  }

  // 2. Release holds older than 72h (funds were never spent; the budget is freed on chain).
  const holds = await prisma.hold.findMany({ where: { releasedAt: null, expiresAt: { lt: new Date() } }, take: 200 });
  for (const h of holds) {
    await prisma.hold.update({ where: { id: h.id }, data: { releasedAt: new Date() } });
    result.released++;
  }

  // 3. Poll permission status per non-terminal room.
  const rooms = await prisma.room.findMany({
    where: { status: { in: ["active", "pending_onchain", "paused", "inactive_bot"] }, permission: { isNot: null } },
    include: { permission: true },
  });
  for (const room of rooms) {
    const permRow = room.permission!;
    const sdk = permRow.permissionJson as unknown as SdkPermission;
    let status;
    try {
      status = await readStatus(parseSdkPermission(sdk), sdk.signature as `0x${string}`);
    } catch {
      continue; // fail-closed: try again next tick
    }
    await prisma.permission.update({
      where: { id: permRow.id },
      data: {
        approvedOnchain: status.isApprovedOnchain,
        lastStatusAt: new Date(),
        lastStatusJson: {
          isActive: status.isActive,
          isApprovedOnchain: status.isApprovedOnchain,
          isRevoked: status.isRevoked,
          isExpired: status.isExpired,
          remainingSpend: status.remainingSpend.toString(),
          nextPeriodStart: status.nextPeriodStart.toISOString(),
        },
      },
    });
    result.statusUpdated++;

    if (status.isRevoked && room.status !== "revoked") {
      await prisma.room.update({ where: { id: room.id }, data: { status: "revoked" } });
      result.revoked++;
      if (room.telegramChatId != null) {
        await sendMessage(room.telegramChatId, "This room's spend permission was revoked. Ovryth has stopped and can no longer move any funds.");
      }
    } else if (status.isExpired && room.status !== "expired") {
      await prisma.room.update({ where: { id: room.id }, data: { status: "expired" } });
      result.expired++;
    }
  }

  // 4. Low operator gas alert.
  await maybeAlertLowGas();

  return result;
}

async function maybeAlertLowGas(): Promise<void> {
  const pk = process.env.OVRYTH_OPERATOR_PRIVATE_KEY;
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!pk || !admin) return;
  try {
    const { privateKeyToAccount } = await import("viem/accounts");
    const address = privateKeyToAccount(pk as `0x${string}`).address;
    const bal = await publicClient.getBalance({ address });
    if (bal < LOW_GAS_ETH) {
      await sendMessage(admin, `Ovryth operator ${address} is low on gas: ${formatEther(bal)} ETH. Top up to keep paying.`);
    }
  } catch {
    /* never let the alert break the tick */
  }
}

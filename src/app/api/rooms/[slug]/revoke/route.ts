import { isHex, getAddress } from "viem";
import { json, httpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { receiptClient, readPermissionStatus, SPEND_PERMISSION_MANAGER } from "@/lib/chain";
import { parseSdkPermission, type SdkPermission } from "@/lib/rooms";
import { sendMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";

/**
 * Records a revoke the owner just sent from the console. The tx hash is display
 * metadata only: before anything is stored we wait for the receipt, require a
 * SpendPermissionManager log in it, and confirm the permission reads revoked on
 * chain. A bogus hash can never flip a live room.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: { txHash?: string };
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid JSON body");
  }
  const txHash = body.txHash;
  if (!txHash || !isHex(txHash) || txHash.length !== 66) {
    return httpError(400, "txHash (0x + 64 hex) is required");
  }

  const room = await prisma.room.findUnique({ where: { slug }, include: { permission: true } });
  if (!room || !room.permission) return httpError(404, "room not found");

  let receipt;
  try {
    receipt = await receiptClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 60_000 });
  } catch {
    return httpError(400, "transaction not found or still pending");
  }
  if (receipt.status !== "success") return httpError(400, "transaction reverted");
  const touchedManager = receipt.logs.some((l) => getAddress(l.address) === SPEND_PERMISSION_MANAGER);
  if (!touchedManager) return httpError(400, "transaction did not touch the spend permission manager");

  const sdk = room.permission.permissionJson as unknown as SdkPermission;
  let status;
  try {
    status = await readPermissionStatus(parseSdkPermission(sdk), sdk.signature);
  } catch {
    return httpError(503, "could not read on-chain status, try again");
  }
  if (!status.isRevoked) return httpError(409, "permission is not revoked on chain");

  if (room.status !== "revoked" || !room.revokedTxHash) {
    await prisma.room.update({ where: { id: room.id }, data: { status: "revoked", revokedTxHash: txHash } });
    if (room.telegramChatId != null) {
      await sendMessage(room.telegramChatId, "This room's spend permission was revoked. Ovryth has stopped and can no longer move any funds.");
    }
  }
  return json({ status: "revoked", txHash });
}

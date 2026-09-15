import { isHex, getAddress, parseAbiItem } from "viem";
import { json, httpError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { receiptClient, readPermissionStatus, SPEND_PERMISSION_MANAGER } from "@/lib/chain";
import { parseSdkPermission, type SdkPermission } from "@/lib/rooms";
import { sendMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const maxDuration = 60;

const REVOKED_EVENT = parseAbiItem(
  "event SpendPermissionRevoked(bytes32 indexed hash, (address account, address spender, address token, uint160 allowance, uint48 period, uint48 start, uint48 end, uint256 salt, bytes extraData) spendPermission)",
);
// Base public RPCs cap eth_getLogs ranges at ~2,000 blocks; scan back in widening chunks.
const LOG_SPANS = [1_999n, 8_000n, 32_000n, 120_000n];

/**
 * Confirms a revoke on chain and records it. The wallet flow (requestRevoke /
 * wallet_sendCalls) returns a call-bundle id, not a tx hash, so the hash is
 * optional: when omitted we discover the revoke tx from the SpendPermissionRevoked
 * event indexed by this room's permission hash. State is only ever flipped after
 * the permission reads revoked on chain, so a bogus call can never kill a room.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  let body: { txHash?: string } = {};
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid JSON body");
  }
  const txHash = body.txHash;
  if (txHash !== undefined && (!isHex(txHash) || txHash.length !== 66)) {
    return httpError(400, "txHash must be 0x + 64 hex");
  }

  const room = await prisma.room.findUnique({ where: { slug }, include: { permission: true } });
  if (!room || !room.permission) return httpError(404, "room not found");

  const sdk = room.permission.permissionJson as unknown as SdkPermission;
  let status;
  try {
    status = await readPermissionStatus(parseSdkPermission(sdk), sdk.signature);
  } catch {
    return httpError(503, "could not read on-chain status, try again");
  }
  if (!status.isRevoked) return httpError(409, "permission is not revoked on chain");

  let recordedHash: string | null = room.revokedTxHash;
  if (txHash) {
    let receipt;
    try {
      receipt = await receiptClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch {
      return httpError(400, "transaction not found");
    }
    if (receipt.status !== "success") return httpError(400, "transaction reverted");
    const touchedManager = receipt.logs.some((l) => getAddress(l.address) === SPEND_PERMISSION_MANAGER);
    if (!touchedManager) return httpError(400, "transaction did not touch the spend permission manager");
    recordedHash = txHash;
  }
  if (!recordedHash) recordedHash = await findRevokeTxHash(room.permission.hash);

  if (room.status !== "revoked" || !room.revokedTxHash) {
    await prisma.room.update({ where: { id: room.id }, data: { status: "revoked", revokedTxHash: recordedHash } });
    if (room.telegramChatId != null) {
      await sendMessage(room.telegramChatId, "This room's spend permission was revoked. Ovryth has stopped and can no longer move any funds.");
    }
  }
  return json({ status: "revoked", txHash: recordedHash });
}

async function findRevokeTxHash(permissionHash: string): Promise<string | null> {
  try {
    const latest = await receiptClient.getBlockNumber();
    for (const span of LOG_SPANS) {
      const fromBlock = latest > span ? latest - span : 0n;
      try {
        const logs = await receiptClient.getLogs({
          address: SPEND_PERMISSION_MANAGER,
          event: REVOKED_EVENT,
          args: { hash: permissionHash as `0x${string}` },
          fromBlock,
          toBlock: "latest",
        });
        if (logs.length) return logs[logs.length - 1].transactionHash;
        if (fromBlock === 0n) return null;
      } catch {
        /* widen the range and retry */
      }
    }
  } catch {
    /* discovery is best-effort */
  }
  return null;
}

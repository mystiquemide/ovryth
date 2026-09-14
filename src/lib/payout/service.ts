import { getAddress, decodeErrorResult, type Hex } from "viem";
import { prisma } from "@/lib/db";
import {
  PAYER_ADDRESS,
  publicClient,
  receiptClient,
  getOperatorWalletClient,
  readPermissionStatus,
  ChainStatusError,
} from "@/lib/chain";
import { parseSdkPermission, type SdkPermission } from "@/lib/rooms";
import { encodePay } from "./pay";

/** Manager + wallet custom errors, for decoding a simulated revert reason. */
const ERROR_ABI = [
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "NotOperator", inputs: [] },
  { type: "error", name: "ApproveFailed", inputs: [] },
  { type: "error", name: "InvalidSignature", inputs: [] },
  { type: "error", name: "UnauthorizedSpendPermission", inputs: [] },
  { type: "error", name: "ExceededSpendPermission", inputs: [{ name: "value", type: "uint256" }, { name: "allowance", type: "uint256" }] },
  { type: "error", name: "SpendValueOverflow", inputs: [{ name: "value", type: "uint256" }] },
] as const;

function decodeRevert(err: unknown): string {
  const data = (err as { cause?: { data?: Hex }; data?: Hex })?.cause?.data ?? (err as { data?: Hex })?.data;
  if (data) {
    try {
      const d = decodeErrorResult({ abi: ERROR_ABI, data });
      return `${d.errorName}(${(d.args ?? []).map(String).join(", ")})`;
    } catch { /* fall through */ }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0]!.slice(0, 200);
}

export class PayoutError extends Error {}

/** Create a queued Payout for a paying Decision. Idempotent per decision. */
export async function enqueuePayout(decisionId: string): Promise<string> {
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: { payout: true, candidate: { include: { message: { include: { member: { include: { wallet: true } } } } } } },
  });
  if (!decision) throw new PayoutError(`decision ${decisionId} not found`);
  if (decision.payout) return decision.payout.id;
  const wallet = decision.candidate.message.member.wallet;
  if (!wallet) throw new PayoutError("member has no linked wallet (should be a hold, not a payout)");
  if (decision.finalAmountUsdc <= 0n) throw new PayoutError("decision amount is zero");

  const payout = await prisma.payout.create({
    data: { decisionId, walletAddress: getAddress(wallet.address), amountUsdc: decision.finalAmountUsdc, status: "queued" },
  });
  return payout.id;
}

export interface ProcessResult {
  status: "confirmed" | "reverted" | "failed";
  txHash?: Hex;
  error?: string;
}

/**
 * Send a queued Payout through OvrythPayer.pay(). Fail-closed and money-safe:
 * - reads permission status (throws => leave queued for retry, never assume good);
 * - refuses to send if the permission is inactive/revoked;
 * - simulates first (default) and records a revert WITHOUT spending gas;
 * - on send, waits for the receipt and records confirmed or reverted.
 * `simulateFirst: false` forces an on-chain send (used to record a real over-cap revert tx).
 */
export async function processPayout(payoutId: string, opts: { simulateFirst?: boolean } = {}): Promise<ProcessResult> {
  if (!PAYER_ADDRESS) throw new PayoutError("payer address not configured");
  const simulateFirst = opts.simulateFirst ?? true;

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { decision: { include: { candidate: { include: { message: { include: { member: true, room: { include: { permission: true } } } } } } } } },
  });
  if (!payout) throw new PayoutError(`payout ${payoutId} not found`);
  if (payout.status === "confirmed") return { status: "confirmed", txHash: (payout.txHash ?? undefined) as Hex | undefined };

  const permRow = payout.decision.candidate.message.room.permission;
  if (!permRow) throw new PayoutError("room has no permission");
  const sdk = permRow.permissionJson as unknown as SdkPermission;
  const perm = parseSdkPermission(sdk);
  const recipient = getAddress(payout.walletAddress);
  const amount = payout.amountUsdc;

  // Status read is fail-closed: on error leave the job queued for the sweeper to retry.
  let needsApprove: boolean;
  try {
    const status = await readPermissionStatus(perm, sdk.signature);
    if (status.isRevoked || !status.isActive) {
      await prisma.payout.update({ where: { id: payoutId }, data: { status: "reverted", lastError: status.isRevoked ? "permission revoked" : "permission inactive", attempts: { increment: 1 } } });
      return { status: "reverted", error: status.isRevoked ? "permission revoked" : "permission inactive" };
    }
    needsApprove = !status.isApprovedOnchain;
  } catch (e) {
    if (e instanceof ChainStatusError) {
      await prisma.payout.update({ where: { id: payoutId }, data: { lastError: "status read failed; will retry", attempts: { increment: 1 } } });
      return { status: "failed", error: "status read failed" };
    }
    throw e;
  }

  const data = encodePay(perm, sdk.signature as Hex, needsApprove, amount, recipient);
  const wallet = getOperatorWalletClient();
  const from = wallet.account.address;

  if (simulateFirst) {
    try {
      await publicClient.call({ account: from, to: PAYER_ADDRESS, data });
    } catch (e) {
      const reason = decodeRevert(e);
      await prisma.payout.update({ where: { id: payoutId }, data: { status: "reverted", lastError: `sim: ${reason}`, attempts: { increment: 1 } } });
      return { status: "reverted", error: reason };
    }
  }

  const txHash = await wallet.sendTransaction({ to: PAYER_ADDRESS, data });
  await prisma.payout.update({ where: { id: payoutId }, data: { status: "sent", txHash, attempts: { increment: 1 } } });

  const rcpt = await receiptClient.waitForTransactionReceipt({ hash: txHash });
  if (rcpt.status === "success") {
    await prisma.$transaction([
      prisma.payout.update({ where: { id: payoutId }, data: { status: "confirmed", blockNumber: rcpt.blockNumber, confirmedAt: new Date() } }),
      prisma.member.update({ where: { id: payout.decision.candidate.message.member.id }, data: { paidThisWeekUsdc: { increment: amount } } }),
    ]);
    return { status: "confirmed", txHash };
  }

  await prisma.payout.update({ where: { id: payoutId }, data: { status: "reverted", lastError: "tx reverted on chain" } });
  return { status: "reverted", txHash, error: "tx reverted on chain" };
}

import { prisma } from "./db";
import { getRoomView, SHOWCASE_SLUG } from "./room-view";
import { baseScanTx, baseScanAddress } from "./format";

// Real Base mainnet artifacts. Approval lands inside the first payout (approve-in-pay),
// so the approval row links the earliest confirmed payout, not whichever payout is latest.
const PAYER = process.env.NEXT_PUBLIC_PAYER_ADDRESS ?? "0x485457f86fbf5e2385ae183bd5518c7d965e3999";

export interface ProofRow {
  label: string;
  kind: "tx" | "address";
  value: string | null; // null => not yet, render an honest empty state
  href: string | null;
  note: string;
}

export async function getProofArtifacts(): Promise<ProofRow[]> {
  const room = await getRoomView(SHOWCASE_SLUG);
  const [lastStatus, revokedRoom] = await Promise.all([
    prisma.permission.aggregate({ _max: { lastStatusAt: true } }),
    prisma.room.findFirst({ where: { revokedTxHash: { not: null } }, orderBy: { createdAt: "desc" }, select: { revokedTxHash: true } }),
  ]);
  const lastTick = lastStatus._max.lastStatusAt;

  const approvalTx = room?.proof.firstPayoutTx ?? null;
  const payoutTx = room?.proof.latestPayoutTx ?? null;
  const revertTx = room?.proof.latestRevertTx ?? null;
  const revokeTx = revokedRoom?.revokedTxHash ?? null;

  return [
    {
      label: "Permission approval",
      kind: "tx",
      value: approvalTx,
      href: approvalTx ? baseScanTx(approvalTx) : null,
      note: "The project's Base Account signed a weekly spend permission naming the payer as the only spender. Registration happens inside the first payout transaction, not as a separate step.",
    },
    {
      label: "Capped payout",
      kind: "tx",
      value: payoutTx,
      href: payoutTx ? baseScanTx(payoutTx) : null,
      note: "A real payout executed by the payer contract: spend within the cap, then transfer to the member wallet in one transaction.",
    },
    {
      label: "Over-cap revert",
      kind: "tx",
      value: revertTx,
      href: revertTx ? baseScanTx(revertTx) : null,
      note: "A payout past the weekly allowance. It reverts on chain and is recorded, so the cap cannot be crossed.",
    },
    {
      label: "Revoke",
      kind: "tx",
      value: revokeTx,
      href: revokeTx ? baseScanTx(revokeTx) : null,
      note: revokeTx
        ? "The project's account revoked the spend permission in one transaction. Ovryth stopped immediately and can no longer move funds."
        : "No revoke yet. Revoking is one on-chain transaction from the project's account; Ovryth stops immediately and can no longer move funds.",
    },
    {
      label: "Payer contract (verified)",
      kind: "address",
      value: PAYER,
      href: `${baseScanAddress(PAYER)}#code`,
      note: "The OvrythPayer contract with verified source. No withdraw, no arbitrary call, no way to hold funds.",
    },
    {
      label: "Last sweeper tick",
      kind: "tx",
      value: lastTick ? lastTick.toISOString() : null,
      href: null,
      note: "The minute sweeper polls permission status, releases expired holds, and retries payouts. Shows the last run time once live.",
    },
  ];
}

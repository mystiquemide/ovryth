import { prisma } from "./db";
import { getRoomView, SHOWCASE_SLUG } from "./room-view";
import { baseScanTx, baseScanAddress } from "./format";

// Real Base mainnet artifacts.
const APPROVAL_TX = "0x3c094b82d51e5ac24a2c9fa05ed6e47d7dfe140a073528fc0b1f3d5241fc5783";
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
  const lastStatus = await prisma.permission.aggregate({ _max: { lastStatusAt: true } });
  const lastTick = lastStatus._max.lastStatusAt;

  const payoutTx = room?.proof.latestPayoutTx ?? null;
  const revertTx = room?.proof.latestRevertTx ?? null;

  return [
    {
      label: "Permission approval",
      kind: "tx",
      value: APPROVAL_TX,
      href: baseScanTx(APPROVAL_TX),
      note: "The project's Base Account signed a weekly spend permission on chain, naming the payer as the only spender.",
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
      value: null,
      href: null,
      note: "No revoke yet. Revoking is one on-chain transaction from the project's account; Ovryth stops immediately and can no longer move funds.",
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

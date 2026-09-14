import { formatEther } from "viem";
import { prisma } from "./db";
import { publicClient } from "./chain/clients";

const OPERATOR_FALLBACK = "0xFfdf04aE758530f78Cd929523293756b6eE6Cd4b";

export interface OperatorNotes {
  lastTick: string | null;
  pendingJobs: number;
  operatorAddress: string;
  operatorGasEth: string | null;
}

/** Owner-console operator notes: last sweeper run, queued work, and operator gas. */
export async function getOperatorNotes(): Promise<OperatorNotes> {
  const [lastStatus, queuedPayouts, queuedJobs] = await Promise.all([
    prisma.permission.aggregate({ _max: { lastStatusAt: true } }),
    prisma.payout.count({ where: { status: "queued" } }),
    prisma.job.count({ where: { status: { in: ["queued", "running"] } } }),
  ]);

  let operatorAddress = OPERATOR_FALLBACK;
  const pk = process.env.OVRYTH_OPERATOR_PRIVATE_KEY;
  if (pk) {
    try {
      const { privateKeyToAccount } = await import("viem/accounts");
      operatorAddress = privateKeyToAccount(pk as `0x${string}`).address;
    } catch {
      /* keep fallback */
    }
  }

  let operatorGasEth: string | null = null;
  try {
    const bal = await publicClient.getBalance({ address: operatorAddress as `0x${string}` });
    operatorGasEth = Number(formatEther(bal)).toFixed(5);
  } catch {
    operatorGasEth = null; // fail-closed: show unknown rather than a fake value
  }

  return {
    lastTick: lastStatus._max.lastStatusAt ? lastStatus._max.lastStatusAt.toISOString() : null,
    pendingJobs: queuedPayouts + queuedJobs,
    operatorAddress,
    operatorGasEth,
  };
}

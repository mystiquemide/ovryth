import { prisma } from "@/lib/db";
import { readPermissionStatus, ChainStatusError } from "@/lib/chain";
import { parseSdkPermission, type SdkPermission } from "@/lib/rooms";
import { fromMicroUsdc, toMicroUsdc } from "@/lib/rules";
import { scoreContribution, type ClassifyFn, type EngineResult } from "./engine";
import type { Category, Rules } from "./types";

const DAY_MS = 86_400_000;

/**
 * Score a stored message end to end and persist a Candidate + Decision. Loads room rules,
 * member facts, live remaining allowance (fail-closed), and room-wide duplicate history,
 * then runs the pipeline. Downstream tasks create Refusal/Payout/Hold rows from the Decision.
 */
export async function runEngineForMessage(
  messageId: string,
  deps: { classify?: ClassifyFn } = {},
): Promise<{ decisionId: string; candidateId: string; result: EngineResult }> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      member: { include: { wallet: true } },
      room: {
        include: {
          permission: true,
          rulesVersions: { orderBy: { version: "desc" }, take: 1 },
          questions: { where: { active: true }, orderBy: { pinnedAt: "asc" } },
        },
      },
    },
  });
  if (!message) throw new Error(`message ${messageId} not found`);
  const rv = message.room.rulesVersions[0];
  if (!rv) throw new Error(`room ${message.room.id} has no rules version`);

  const rules: Rules = {
    version: rv.version,
    categories: rv.categories as unknown as Category[],
    memberWeeklyCapUsdc: fromMicroUsdc(rv.memberWeeklyCapUsdc),
    roomDailyCapUsdc: fromMicroUsdc(rv.roomDailyCapUsdc),
    minAccountAgeDays: rv.minAccountAgeDays,
    minTenureDays: rv.minTenureDays,
    freeText: rv.freeText,
  };

  const tenureDays = Math.floor((Date.now() - message.member.firstSeenAt.getTime()) / DAY_MS);

  // Room remaining allowance from chain, fail-closed (0 on read error => no payment).
  let remainingAllowanceUsdc = 0;
  if (message.room.permission) {
    try {
      const perm = parseSdkPermission(message.room.permission.permissionJson as unknown as SdkPermission);
      const status = await readPermissionStatus(perm, (message.room.permission.permissionJson as unknown as SdkPermission).signature);
      remainingAllowanceUsdc = status.isActive && !status.isRevoked ? fromMicroUsdc(status.remainingSpend) : 0;
    } catch (e) {
      if (!(e instanceof ChainStatusError)) throw e;
      remainingAllowanceUsdc = 0;
    }
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const paidTodayAgg = await prisma.payout.aggregate({
    _sum: { amountUsdc: true },
    where: { status: "confirmed", confirmedAt: { gte: startOfDay }, decision: { candidate: { message: { roomId: message.roomId } } } },
  });
  const paidTodayUsdc = fromMicroUsdc(paidTodayAgg._sum.amountUsdc ?? 0n);

  // Room-wide duplicate history: recent messages + every message that was ever paid.
  const recent = await prisma.message.findMany({
    where: { roomId: message.roomId, id: { not: message.id } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { simhash: true, contentHash: true },
  });
  const paid = await prisma.message.findMany({
    where: { roomId: message.roomId, candidates: { some: { decision: { payout: { status: "confirmed" } } } } },
    select: { simhash: true, contentHash: true },
  });
  const priorSimhashes = [...recent, ...paid].map((m) => BigInt(m.simhash));
  const priorContentHashes = [...recent, ...paid].map((m) => m.contentHash);

  const result = await scoreContribution(
    {
      text: message.text,
      rules,
      questions: message.room.questions.map((q) => q.text),
      member: {
        approxAccountAgeDays: message.member.approxAccountAgeDays,
        tenureDays,
        paidThisWeekUsdc: fromMicroUsdc(message.member.paidThisWeekUsdc),
        publicRefusalsToday: message.member.publicRefusalsToday,
        hasLinkedWallet: !!message.member.wallet,
      },
      room: { paidTodayUsdc, remainingAllowanceUsdc },
      priorSimhashes,
      priorContentHashes,
    },
    deps,
  );

  const { decisionId, candidateId } = await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.create({
      data: {
        messageId: message.id,
        rulesVersionId: rv.id,
        modelOutput: (result.verdict ?? { prefilter: result.decision.reasonCode }) as unknown as object,
        provider: result.provider ?? "prefilter",
        latencyMs: result.latencyMs,
      },
    });
    const decision = await tx.decision.create({
      data: {
        candidateId: candidate.id,
        finalAmountUsdc: toMicroUsdc(result.decision.amountUsdc),
        reasonCode: result.decision.reasonCode,
        reasonText: result.decision.reasonText,
        policyNotes: { pay: result.decision.pay, hold: result.decision.hold, categoryKey: result.decision.categoryKey, notes: result.decision.notes } as unknown as object,
      },
    });
    return { decisionId: decision.id, candidateId: candidate.id };
  });

  return { decisionId, candidateId, result };
}

import { prisma } from "./db";
import { fromMicroUsdc } from "./rules";
import type { VerdictRowData } from "@/components/VerdictRow";

function timeLabel(d: Date): string {
  return d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

function currentPermissionPeriod(start: bigint, periodSeconds: number, nowMs = Date.now()) {
  const startMs = Number(start) * 1000;
  const durationMs = Math.max(1, periodSeconds) * 1000;
  const index = nowMs <= startMs ? 0 : Math.floor((nowMs - startMs) / durationMs);
  const periodStartMs = startMs + index * durationMs;
  return { startMs: periodStartMs, endMs: periodStartMs + durationMs, durationMs };
}

function formatReset(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  return `${date} ${time} UTC`;
}

export interface ShowcaseData {
  slug: string;
  name: string;
  capUsdc: number;
  paidUsdc: number;
  segments: { amountUsdc: number; txHash?: string }[];
  refusals: { atFraction: number }[];
  reverted: boolean;
  resetLabel: string;
  rows: VerdictRowData[];
  questions: string[];
  examplePaidTxHash: string | null;
  examplePaidAmount: number | null;
}

/** Read the seeded showcase room from the DB (no chain call). Returns null if not seeded. */
export async function getShowcase(slug = "ovryth"): Promise<ShowcaseData | null> {
  const room = await prisma.room.findUnique({
    where: { slug },
    include: { permission: true, questions: { where: { active: true }, orderBy: { pinnedAt: "asc" } } },
  });
  if (!room || !room.permission) return null;

  const [payouts, refusals] = await Promise.all([
    prisma.payout.findMany({
      where: { decision: { candidate: { message: { roomId: room.id } } } },
      include: { decision: { include: { candidate: { include: { message: { include: { member: true } } } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.refusal.findMany({
      where: { public: true, decision: { candidate: { message: { roomId: room.id } } } },
      include: { decision: { include: { candidate: { include: { message: { include: { member: true } } } } } } },
    }),
  ]);

  const confirmed = payouts.filter((p) => p.status === "confirmed");
  const period = currentPermissionPeriod(room.permission.start, room.permission.periodSeconds);
  const currentConfirmed = confirmed.filter((p) => {
    const at = (p.confirmedAt ?? p.createdAt).getTime();
    return at >= period.startMs && at < period.endMs;
  });
  const currentRefusals = refusals.filter((r) => {
    const at = r.decision.decidedAt.getTime();
    return at >= period.startMs && at < period.endMs;
  });
  const currentReverted = payouts.filter((p) => {
    if (p.status !== "reverted") return false;
    const at = (p.confirmedAt ?? p.createdAt).getTime();
    return at >= period.startMs && at < period.endMs;
  });

  const capUsdc = fromMicroUsdc(room.permission.allowanceUsdc);
  const paidUsdc = currentConfirmed.reduce((s, p) => s + fromMicroUsdc(p.amountUsdc), 0);

  const segments = [...currentConfirmed]
    .sort((a, b) => (a.confirmedAt?.getTime() ?? 0) - (b.confirmedAt?.getTime() ?? 0))
    .map((p) => ({ amountUsdc: fromMicroUsdc(p.amountUsdc), txHash: p.txHash ?? undefined }));

  const refusalTicks = currentRefusals.map((r) => {
    const at = r.decision.decidedAt.getTime();
    return { atFraction: Math.max(0.02, Math.min(0.98, (at - period.startMs) / period.durationMs)) };
  });

  const paidRows: VerdictRowData[] = confirmed.map((p) => {
    const m = p.decision.candidate.message;
    const cat = (p.decision.policyNotes as { categoryKey?: string } | null)?.categoryKey ?? null;
    return {
      time: timeLabel(p.confirmedAt ?? m.createdAt),
      member: `@${m.member.username ?? "member"}`,
      category: cat,
      amountUsdc: fromMicroUsdc(p.amountUsdc),
      reason: p.decision.reasonText,
      kind: "paid",
      txHash: p.txHash ?? undefined,
      seeded: true,
    };
  });

  const refusedRows: VerdictRowData[] = refusals.map((r) => {
    const m = r.decision.candidate.message;
    return {
      time: timeLabel(m.createdAt),
      member: `@${m.member.username ?? "member"}`,
      category: null,
      amountUsdc: null,
      reason: r.decision.reasonText,
      kind: "refused",
      seeded: true,
    };
  });

  const rows = [...paidRows, ...refusedRows]
    .sort((a, b) => (b.time > a.time ? 1 : -1))
    .slice(0, 3);

  const firstPaid = confirmed[0];
  return {
    slug: room.slug,
    name: room.name,
    capUsdc,
    paidUsdc,
    segments,
    refusals: refusalTicks,
    reverted: currentReverted.length > 0,
    resetLabel: `resets ${formatReset(period.endMs)}`,
    rows,
    questions: room.questions.map((q) => q.text),
    examplePaidTxHash: firstPaid?.txHash ?? null,
    examplePaidAmount: firstPaid ? fromMicroUsdc(firstPaid.amountUsdc) : null,
  };
}

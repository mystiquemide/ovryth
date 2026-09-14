import { prisma } from "./db";
import { fromMicroUsdc } from "./rules";
import type { VerdictRowData } from "@/components/VerdictRow";

const WEEK_MS = 7 * 86_400_000;

function timeLabel(d: Date): string {
  return d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
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
  const capUsdc = fromMicroUsdc(room.permission.allowanceUsdc);
  const paidUsdc = confirmed.reduce((s, p) => s + fromMicroUsdc(p.amountUsdc), 0);
  const now = Date.now();

  const segments = [...confirmed]
    .sort((a, b) => (a.confirmedAt?.getTime() ?? 0) - (b.confirmedAt?.getTime() ?? 0))
    .map((p) => ({ amountUsdc: fromMicroUsdc(p.amountUsdc), txHash: p.txHash ?? undefined }));

  const refusalTicks = refusals.map((r) => {
    const at = r.decision.candidate.message.createdAt.getTime();
    return { atFraction: Math.max(0.02, Math.min(0.98, 1 - (now - at) / WEEK_MS)) };
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
    reverted: payouts.some((p) => p.status === "reverted"),
    resetLabel: "resets Mon 00:00 UTC",
    rows,
    questions: room.questions.map((q) => q.text),
    examplePaidTxHash: firstPaid?.txHash ?? null,
    examplePaidAmount: firstPaid ? fromMicroUsdc(firstPaid.amountUsdc) : null,
  };
}

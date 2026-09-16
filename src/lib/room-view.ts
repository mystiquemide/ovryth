import { prisma } from "./db";
import { fromMicroUsdc } from "./rules";
import type { VerdictRowData } from "@/components/VerdictRow";

const MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";
const PAYER = process.env.NEXT_PUBLIC_PAYER_ADDRESS ?? "0x485457f86fbf5e2385ae183bd5518c7d965e3999";
const END_SENTINEL = 4_102_444_800n; // ~year 2100; anything above reads as open-ended
export const SHOWCASE_SLUG = "ovryth";

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

export interface Category { key: string; label: string; minUsdc: number; maxUsdc: number }

export interface RoomView {
  slug: string;
  name: string;
  tokenSymbol: string;
  status: string;
  seeded: boolean;
  external: boolean;
  budget: {
    capUsdc: number;
    paidUsdc: number;
    segments: { amountUsdc: number; txHash?: string }[];
    refusals: { atFraction: number }[];
    reverted: boolean;
    revoked: boolean;
    resetLabel: string;
  };
  permission: {
    account: string;
    spender: string;
    manager: string;
    allowanceUsdc: number;
    remainingUsdc: number;
    nextReset: string;
    endDate: string;
    status: "active" | "revoked" | "expired" | "pending";
    sdkPermission: unknown; // raw permissionJson for requestRevoke (public on-chain data)
  } | null;
  revokedTxHash: string | null;
  rules: {
    version: number;
    categories: Category[];
    memberWeeklyCapUsdc: number;
    roomDailyCapUsdc: number;
    minAccountAgeDays: number;
    minTenureDays: number;
    freeText: string;
  } | null;
  questions: string[];
  paidRows: VerdictRowData[];
  refusedRows: VerdictRowData[];
  totals: { paidUsdc: number; payoutCount: number; refusalCount: number };
  proof: {
    firstPayoutTx: string | null;
    latestPayoutTx: string | null;
    latestRevertTx: string | null;
    payer: string;
    examplePaidAmount: number | null;
  };
}

export async function getRoomView(slug: string): Promise<RoomView | null> {
  const room = await prisma.room.findUnique({
    where: { slug },
    include: {
      permission: true,
      rulesVersions: { orderBy: { version: "desc" }, take: 1 },
      questions: { where: { active: true }, orderBy: { pinnedAt: "asc" } },
    },
  });
  if (!room) return null;

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
  const reverted = payouts.filter((p) => p.status === "reverted");
  const firstConfirmed = [...confirmed].sort(
    (a, b) => (a.confirmedAt?.getTime() ?? a.createdAt.getTime()) - (b.confirmedAt?.getTime() ?? b.createdAt.getTime()),
  )[0];
  const seeded = room.slug === SHOWCASE_SLUG;
  const capUsdc = room.permission ? fromMicroUsdc(room.permission.allowanceUsdc) : 0;
  const period = room.permission ? currentPermissionPeriod(room.permission.start, room.permission.periodSeconds) : null;
  const currentConfirmed = period
    ? confirmed.filter((p) => {
        const at = (p.confirmedAt ?? p.createdAt).getTime();
        return at >= period.startMs && at < period.endMs;
      })
    : confirmed;
  const currentRefusals = period
    ? refusals.filter((r) => {
        const at = r.decision.decidedAt.getTime();
        return at >= period.startMs && at < period.endMs;
      })
    : refusals;
  const currentReverted = period
    ? reverted.filter((p) => {
        const at = (p.confirmedAt ?? p.createdAt).getTime();
        return at >= period.startMs && at < period.endMs;
      })
    : reverted;
  const paidUsdc = currentConfirmed.reduce((s, p) => s + fromMicroUsdc(p.amountUsdc), 0);

  const segments = [...currentConfirmed]
    .sort((a, b) => (a.confirmedAt?.getTime() ?? 0) - (b.confirmedAt?.getTime() ?? 0))
    .map((p) => ({ amountUsdc: fromMicroUsdc(p.amountUsdc), txHash: p.txHash ?? undefined }));

  const refusalTicks = currentRefusals.map((r) => {
    const at = r.decision.decidedAt.getTime();
    if (!period) return { atFraction: 0.5 };
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
      editedAfterPayment: m.editedAfterDecision,
      seeded,
    };
  });

  const refusedRows: VerdictRowData[] = refusals.map((r) => {
    const m = r.decision.candidate.message;
    return { time: timeLabel(m.createdAt), member: `@${m.member.username ?? "member"}`, category: null, amountUsdc: null, reason: r.decision.reasonText, kind: "refused", seeded };
  });

  const rv = room.rulesVersions[0] ?? null;
  const statusMap: Record<string, "active" | "revoked" | "expired" | "pending"> = { active: "active", revoked: "revoked", expired: "expired" };
  const nextReset = period ? formatReset(period.endMs) : "not scheduled";

  return {
    slug: room.slug,
    name: room.name,
    tokenSymbol: room.tokenSymbol,
    status: room.status,
    seeded,
    external: room.external,
    budget: {
      capUsdc,
      paidUsdc,
      segments,
      refusals: refusalTicks,
      reverted: currentReverted.length > 0,
      revoked: room.status === "revoked",
      resetLabel: `resets ${nextReset}`,
    },
    permission: room.permission
      ? {
          account: room.ownerAccount,
          spender: PAYER,
          manager: MANAGER,
          allowanceUsdc: capUsdc,
          remainingUsdc: Math.max(0, capUsdc - paidUsdc),
          nextReset,
          endDate: room.permission.end >= END_SENTINEL ? "open-ended" : new Date(Number(room.permission.end) * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }),
          status: statusMap[room.status] ?? "pending",
          sdkPermission: room.permission.permissionJson,
        }
      : null,
    revokedTxHash: room.revokedTxHash ?? null,
    rules: rv
      ? {
          version: rv.version,
          categories: rv.categories as unknown as Category[],
          memberWeeklyCapUsdc: fromMicroUsdc(rv.memberWeeklyCapUsdc),
          roomDailyCapUsdc: fromMicroUsdc(rv.roomDailyCapUsdc),
          minAccountAgeDays: rv.minAccountAgeDays,
          minTenureDays: rv.minTenureDays,
          freeText: rv.freeText,
        }
      : null,
    questions: room.questions.map((q) => q.text),
    paidRows,
    refusedRows,
    totals: {
      paidUsdc: confirmed.reduce((s, p) => s + fromMicroUsdc(p.amountUsdc), 0),
      payoutCount: confirmed.length,
      refusalCount: refusals.length,
    },
    proof: {
      firstPayoutTx: firstConfirmed?.txHash ?? null,
      latestPayoutTx: confirmed[0]?.txHash ?? null,
      latestRevertTx: reverted[0]?.txHash ?? null,
      payer: PAYER,
      examplePaidAmount: confirmed[0] ? fromMicroUsdc(confirmed[0].amountUsdc) : null,
    },
  };
}

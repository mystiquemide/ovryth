import { prisma } from "./db";
import { fromMicroUsdc } from "./rules";
import type { VerdictRowData } from "@/components/VerdictRow";

const MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";
const PAYER = process.env.NEXT_PUBLIC_PAYER_ADDRESS ?? "0x485457f86fbf5e2385ae183bd5518c7d965e3999";
const WEEK_MS = 7 * 86_400_000;
const END_SENTINEL = 4_102_444_800n; // ~year 2100; anything above reads as open-ended
export const SHOWCASE_SLUG = "ovryth";

function timeLabel(d: Date): string {
  return d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

function nextMondayUtcLabel(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun..6 Sat
  const daysUntilMon = (8 - (day === 0 ? 7 : day)) % 7 || 7;
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMon));
  return `${next.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })} 00:00 UTC`;
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
      reverted: reverted.length > 0,
      revoked: room.status === "revoked",
      resetLabel: `resets ${nextMondayUtcLabel()}`,
    },
    permission: room.permission
      ? {
          account: room.ownerAccount,
          spender: PAYER,
          manager: MANAGER,
          allowanceUsdc: capUsdc,
          remainingUsdc: Math.max(0, capUsdc - paidUsdc),
          nextReset: nextMondayUtcLabel(),
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
    totals: { paidUsdc, payoutCount: confirmed.length, refusalCount: refusals.length },
    proof: {
      firstPayoutTx: firstConfirmed?.txHash ?? null,
      latestPayoutTx: confirmed[0]?.txHash ?? null,
      latestRevertTx: reverted[0]?.txHash ?? null,
      payer: PAYER,
      examplePaidAmount: confirmed[0] ? fromMicroUsdc(confirmed[0].amountUsdc) : null,
    },
  };
}

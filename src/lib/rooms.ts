import { randomBytes } from "node:crypto";
import { getAddress, type Address, type Hex } from "viem";
import { prisma } from "./db";
import {
  PAYER_ADDRESS,
  verifyPermission,
  readPermissionStatus,
  ChainStatusError,
  type SpendPermission,
} from "./chain";
import { verifyOwnerSignature } from "./owner-auth";
import { buildRulesV1, toMicroUsdc, type RulesInput } from "./rules";
import { uniqueSlug } from "./slug";

export class RoomError extends Error {
  constructor(readonly status: number, message: string, readonly reasons?: string[]) {
    super(message);
    this.name = "RoomError";
  }
}

/** The SDK permission object (string-encoded numeric fields) as submitted by the browser. */
export interface SdkPermission {
  signature: Hex;
  chainId: number;
  permission: {
    account: string;
    spender: string;
    token: string;
    allowance: string;
    period: number;
    start: number;
    end: number;
    salt: string;
    extraData: string;
  };
}

export function parseSdkPermission(sdk: SdkPermission): SpendPermission {
  const p = sdk.permission;
  return {
    account: getAddress(p.account),
    spender: getAddress(p.spender),
    token: getAddress(p.token),
    allowance: BigInt(p.allowance),
    period: Number(p.period),
    start: Number(p.start),
    end: Number(p.end),
    salt: BigInt(p.salt),
    extraData: (p.extraData || "0x") as Hex,
  };
}

export interface CreateRoomInput {
  name: string;
  tokenSymbol: string;
  permission: SdkPermission;
  rules?: Partial<RulesInput>;
  ownerSignature: Hex;
  issuedAt: string;
  external?: boolean;
}

export async function createRoom(input: CreateRoomInput): Promise<{ slug: string; linkCode: string }> {
  if (!PAYER_ADDRESS) throw new RoomError(500, "payer address not configured");
  if (!input.name?.trim() || !input.tokenSymbol?.trim()) throw new RoomError(400, "name and tokenSymbol are required");

  const perm = parseSdkPermission(input.permission);
  const check = verifyPermission(perm, { payer: PAYER_ADDRESS });
  if (!check.ok) throw new RoomError(400, "invalid permission", check.reasons);

  const ownerAccount = perm.account;
  const auth = await verifyOwnerSignature(ownerAccount, { action: "create-room", resource: check.hash, issuedAt: input.issuedAt }, input.ownerSignature);
  if (!auth.ok) throw new RoomError(401, `owner signature rejected: ${auth.reason}`);

  const rules = buildRulesV1(perm.allowance, input.rules);
  const slug = await uniqueSlug(input.name);
  const linkCode = randomBytes(9).toString("base64url");

  await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        slug,
        name: input.name.trim(),
        tokenSymbol: input.tokenSymbol.trim().toUpperCase(),
        ownerAccount,
        linkCode,
        external: input.external ?? false,
        status: "pending_onchain",
      },
    });
    await tx.permission.create({
      data: {
        roomId: room.id,
        permissionJson: input.permission as unknown as object,
        hash: check.hash,
        allowanceUsdc: perm.allowance,
        periodSeconds: perm.period,
        start: BigInt(perm.start),
        end: BigInt(perm.end),
      },
    });
    await tx.rulesVersion.create({
      data: {
        roomId: room.id,
        version: 1,
        categories: rules.categories,
        memberWeeklyCapUsdc: toMicroUsdc(rules.memberWeeklyCapUsdc),
        roomDailyCapUsdc: toMicroUsdc(rules.roomDailyCapUsdc),
        minAccountAgeDays: rules.minAccountAgeDays,
        minTenureDays: rules.minTenureDays,
        freeText: rules.freeText,
      },
    });
  });

  return { slug, linkCode };
}

function weekStartUtc(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

export async function getPublicRoom(slug: string) {
  const room = await prisma.room.findUnique({
    where: { slug },
    include: {
      permission: true,
      rulesVersions: { orderBy: { version: "desc" }, take: 1 },
      questions: { where: { active: true }, orderBy: { pinnedAt: "asc" } },
    },
  });
  if (!room) throw new RoomError(404, "room not found");

  const rulesVersion = room.rulesVersions[0] ?? null;

  // Permission status is fail-closed: on RPC error we return null rather than assume good.
  let permissionStatus: Record<string, unknown> | null = null;
  let statusError = false;
  if (room.permission) {
    try {
      const perm = parseSdkPermission(room.permission.permissionJson as unknown as SdkPermission);
      const s = await readPermissionStatus(perm, (room.permission.permissionJson as unknown as SdkPermission).signature);
      permissionStatus = {
        isActive: s.isActive,
        isApprovedOnchain: s.isApprovedOnchain,
        isRevoked: s.isRevoked,
        isExpired: s.isExpired,
        remainingSpend: s.remainingSpend,
        nextPeriodStart: s.nextPeriodStart,
      };
    } catch (e) {
      statusError = e instanceof ChainStatusError;
      if (!statusError) throw e;
    }
  }

  const since = weekStartUtc();
  const [payouts, refusals] = await Promise.all([
    prisma.payout.findMany({
      where: { status: "confirmed", confirmedAt: { gte: since }, decision: { candidate: { message: { roomId: room.id } } } },
      orderBy: { confirmedAt: "desc" },
      take: 100,
    }),
    prisma.refusal.findMany({
      where: { public: true, decision: { decidedAt: { gte: since }, candidate: { message: { roomId: room.id } } } },
      orderBy: { decision: { decidedAt: "desc" } },
      take: 100,
      include: { decision: true },
    }),
  ]);

  const paidThisWeekUsdc = payouts.reduce((sum, p) => sum + p.amountUsdc, 0n);

  return {
    room: {
      slug: room.slug,
      name: room.name,
      tokenSymbol: room.tokenSymbol,
      ownerAccount: room.ownerAccount,
      status: room.status,
      external: room.external,
      createdAt: room.createdAt,
      linked: room.telegramChatId != null,
    },
    permission: room.permission
      ? { hash: room.permission.hash, allowanceUsdc: room.permission.allowanceUsdc, periodSeconds: room.permission.periodSeconds, approvedOnchain: room.permission.approvedOnchain }
      : null,
    permissionStatus,
    statusError,
    rulesVersion,
    questions: room.questions.map((q) => ({ text: q.text, pinnedAt: q.pinnedAt })),
    week: { payouts, refusals },
    totals: { paidThisWeekUsdc, payoutCount: payouts.length, refusalCount: refusals.length },
  };
}

async function ownerGuard(slug: string, action: string, signature: Hex, issuedAt: string) {
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) throw new RoomError(404, "room not found");
  const auth = await verifyOwnerSignature(room.ownerAccount as Address, { action, resource: slug, issuedAt }, signature);
  if (!auth.ok) throw new RoomError(401, `owner signature rejected: ${auth.reason}`);
  return room;
}

export async function updateRules(
  slug: string,
  fields: Partial<RulesInput>,
  signature: Hex,
  issuedAt: string,
): Promise<{ version: number }> {
  const room = await ownerGuard(slug, "update-rules", signature, issuedAt);
  const permission = await prisma.permission.findUnique({ where: { roomId: room.id } });
  const allowance = permission?.allowanceUsdc ?? 0n;
  const rules = buildRulesV1(allowance, fields);

  const latest = await prisma.rulesVersion.findFirst({ where: { roomId: room.id }, orderBy: { version: "desc" } });
  const version = (latest?.version ?? 0) + 1;
  await prisma.rulesVersion.create({
    data: {
      roomId: room.id,
      version,
      categories: rules.categories,
      memberWeeklyCapUsdc: toMicroUsdc(rules.memberWeeklyCapUsdc),
      roomDailyCapUsdc: toMicroUsdc(rules.roomDailyCapUsdc),
      minAccountAgeDays: rules.minAccountAgeDays,
      minTenureDays: rules.minTenureDays,
      freeText: rules.freeText,
    },
  });
  return { version };
}

export async function setPaused(slug: string, paused: boolean, signature: Hex, issuedAt: string): Promise<{ status: string }> {
  const room = await ownerGuard(slug, "pause", signature, issuedAt);
  if (room.status === "revoked" || room.status === "expired") throw new RoomError(409, `room is ${room.status}`);
  const status = paused ? "paused" : "active";
  await prisma.room.update({ where: { id: room.id }, data: { status } });
  return { status };
}

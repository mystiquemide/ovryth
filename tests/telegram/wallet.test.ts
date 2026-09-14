import { describe, it, expect, afterAll } from "vitest";
import { getAddress } from "viem";
import { prisma } from "../../src/lib/db";
import { linkWallet, ensureMemberWallet } from "../../src/lib/telegram/wallet";

const USER = BigInt(Math.floor(2_000_000_000 + Math.random() * 1e9));
const A = getAddress("0x1111111111111111111111111111111111111111");
const B = getAddress("0x2222222222222222222222222222222222222222");
let roomId: string;

afterAll(async () => {
  await prisma.linkedWallet.deleteMany({ where: { telegramUserId: USER } });
  if (roomId) {
    await prisma.message.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
  }
  await prisma.$disconnect();
});

describe("linkWallet", () => {
  it("rejects an invalid address", async () => {
    const r = await linkWallet(USER, "not-an-address", false);
    expect(r.ok).toBe(false);
  });

  it("links a valid address", async () => {
    const r = await linkWallet(USER, A.toLowerCase(), false);
    expect(r.ok).toBe(true);
    const lw = await prisma.linkedWallet.findUnique({ where: { telegramUserId: USER } });
    expect(getAddress(lw!.address)).toBe(A);
  });

  it("requires confirm to change an existing address", async () => {
    const r = await linkWallet(USER, B, false);
    expect(r.ok).toBe(false);
    expect(r.message.toLowerCase()).toContain("confirm");
    const lw = await prisma.linkedWallet.findUnique({ where: { telegramUserId: USER } });
    expect(getAddress(lw!.address)).toBe(A); // unchanged
  });

  it("changes the address with confirm", async () => {
    const r = await linkWallet(USER, B, true);
    expect(r.ok).toBe(true);
    const lw = await prisma.linkedWallet.findUnique({ where: { telegramUserId: USER } });
    expect(getAddress(lw!.address)).toBe(B);
  });
});

describe("ensureMemberWallet", () => {
  it("syncs a DM-linked wallet into a new membership", async () => {
    const room = await prisma.room.create({
      data: { slug: `wl-test-${Math.random().toString(36).slice(2, 8)}`, name: "WL", tokenSymbol: "WL", ownerAccount: "0x0000000000000000000000000000000000000001", status: "active" },
    });
    roomId = room.id;
    const member = await prisma.member.create({ data: { roomId: room.id, telegramUserId: USER } });
    await ensureMemberWallet(member.id, USER);
    const wallet = await prisma.wallet.findUnique({ where: { memberId: member.id } });
    expect(wallet).not.toBeNull();
    expect(getAddress(wallet!.address)).toBe(B); // the confirmed address
  });
});

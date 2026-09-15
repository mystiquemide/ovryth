/**
 * npm run db:smoke
 * Verifies the database + Prisma adapter by inserting and reading back a Room, then
 * cleaning it up. Requires a real DATABASE_URL (Neon pooler) with migrations applied.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../src/lib/db";

async function main() {
  const slug = `smoke-${Date.now()}`;
  const room = await prisma.room.create({
    data: {
      slug,
      name: "Smoke Room",
      tokenSymbol: "TEST",
      telegramChatId: BigInt(Date.now()),
      ownerAccount: "0x0000000000000000000000000000000000000000",
    },
  });
  const read = await prisma.room.findUnique({ where: { id: room.id } });
  if (!read) throw new Error("insert succeeded but read returned null");
  console.log(`inserted + read Room ${read.id} (slug=${read.slug}, status=${read.status})`);

  await prisma.room.delete({ where: { id: room.id } });
  console.log("cleaned up. db:smoke OK");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("db:smoke failed:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

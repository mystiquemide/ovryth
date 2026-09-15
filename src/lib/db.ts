import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma client over the Postgres driver adapter (Neon pooled endpoint at runtime).
 * Lazily instantiated so importing `prisma` never requires env at module-load time
 * (scripts load .env.local after import hoisting); singleton in dev to avoid
 * exhausting connections on hot reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function explicitVerifiedTls(connectionString: string): string {
  // pg currently treats require/prefer/verify-ca as verify-full but warns that a
  // future major will adopt weaker libpq semantics. Preserve today's verified TLS
  // behavior explicitly without rewriting credentials or other URL parameters.
  return connectionString.replace(
    /([?&]sslmode=)(?:prefer|require|verify-ca)(?=&|$)/i,
    "$1verify-full",
  );
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString: explicitVerifiedTls(connectionString) });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client as object, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

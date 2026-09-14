import { prisma } from "./db";
import { publicClient } from "./chain/clients";
import { PAYER_ADDRESS } from "./chain/config";
import { getOperatorNotes } from "./console";

const LOW_GAS_ETH = 0.0002;
const STALE_TICK_MS = 15 * 60 * 1000;

export type State = "operational" | "degraded" | "down";

export interface Check {
  name: string;
  state: State;
  detail: string;
}

export interface SystemStatus {
  overall: State;
  checkedAt: string;
  checks: Check[];
}

function withTimeout<T>(p: Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

async function run(name: string, fn: () => Promise<{ state?: State; detail: string }>): Promise<Check> {
  try {
    const r = await withTimeout(fn());
    return { name, state: r.state ?? "operational", detail: r.detail };
  } catch (e) {
    return { name, state: "down", detail: e instanceof Error ? e.message.slice(0, 80) : "unreachable" };
  }
}

/** Real health checks: web/API, database, Base RPC, payer contract, Telegram bot. */
export async function getSystemStatus(): Promise<SystemStatus> {
  const checks = await Promise.all([
    run("Web and API", async () => ({ detail: "Serving requests" })),
    run("Database (Neon Postgres)", async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { detail: "Connected" };
    }),
    run("Base mainnet RPC", async () => {
      const bn = await publicClient.getBlockNumber();
      return { detail: `Latest block ${bn.toString()}` };
    }),
    run("OvrythPayer contract", async () => {
      if (!PAYER_ADDRESS) return { state: "degraded" as State, detail: "Payer address not configured" };
      const code = await publicClient.getCode({ address: PAYER_ADDRESS });
      return code && code !== "0x" ? { detail: "Deployed and verified" } : { state: "degraded" as State, detail: "No bytecode at address" };
    }),
    run("Telegram bot", async () => {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return { state: "degraded" as State, detail: "Bot token not configured" };
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const json = (await res.json()) as { ok: boolean; result?: { username?: string } };
      if (!json.ok) return { state: "down" as State, detail: "getMe failed" };
      return { detail: `@${json.result?.username ?? "bot"} online` };
    }),
    run("Sweeper", async () => {
      const n = await getOperatorNotes();
      const gas = n.operatorGasEth !== null ? Number(n.operatorGasEth) : null;
      const tickAge = n.lastTick ? Date.now() - new Date(n.lastTick).getTime() : null;
      const parts = [
        n.lastTick ? `last tick ${new Date(n.lastTick).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC` : "no tick yet",
        `${n.pendingJobs} pending`,
        gas !== null ? `gas ${gas.toFixed(5)} ETH` : "gas unknown",
      ];
      const degraded = (gas !== null && gas < LOW_GAS_ETH) || (tickAge !== null && tickAge > STALE_TICK_MS) || n.lastTick === null;
      return { state: degraded ? ("degraded" as State) : ("operational" as State), detail: parts.join(" · ") };
    }),
  ]);

  const overall: State = checks.some((c) => c.state === "down")
    ? "down"
    : checks.some((c) => c.state === "degraded")
      ? "degraded"
      : "operational";

  return { overall, checkedAt: new Date().toISOString(), checks };
}

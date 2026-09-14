import { NextResponse } from "next/server";
import { appendFileSync } from "node:fs";

export const dynamic = "force-dynamic";

// Only allow the JSON-RPC methods a paymaster/bundler actually serves. This keeps the
// upstream CDP endpoint (which embeds a client key) server-side while still letting the
// Base Account SDK request gas sponsorship for smart-account user operations.
const ALLOWED = new Set([
  "pm_getPaymasterStubData",
  "pm_getPaymasterData",
  "pm_sponsorUserOperation",
  "eth_sendUserOperation",
  "eth_estimateUserOperationGas",
  "eth_getUserOperationByHash",
  "eth_getUserOperationReceipt",
  "eth_supportedEntryPoints",
  "eth_chainId",
]);

export async function POST(req: Request) {
  const url = process.env.CDP_PAYMASTER_URL;
  if (!url) return NextResponse.json({ error: "paymaster not configured" }, { status: 503 });

  let body: { method?: string } | unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const method = (body as { method?: string }).method;
  try {
    appendFileSync("/tmp/paymaster-hits.log", `${new Date().toISOString()} ${method}\n`);
  } catch {
    /* best-effort debug log */
  }
  if (typeof method !== "string" || !ALLOWED.has(method)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await upstream.json();
    return NextResponse.json(json, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 120) : "upstream error" }, { status: 502 });
  }
}

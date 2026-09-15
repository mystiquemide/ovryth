import { NextResponse } from "next/server";
import { clientIp, httpError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Only allow the JSON-RPC methods a paymaster/bundler actually serves. This keeps the
// upstream CDP endpoint (which embeds a client key) server-side while still letting the
// Base Account SDK request gas sponsorship for smart-account user operations.
const ALLOWED = new Set([
  "pm_getPaymasterStubData",
  "pm_getPaymasterData",
  "pm_getAcceptedPaymentTokens",
  "pm_sponsorUserOperation",
  "eth_sendUserOperation",
  "eth_estimateUserOperationGas",
  "eth_getUserOperationByHash",
  "eth_getUserOperationReceipt",
  "eth_supportedEntryPoints",
  "eth_chainId",
]);

export async function POST(req: Request) {
  const limit = rateLimit(`paymaster:${clientIp(req)}`, 60, 60 * 1000);
  if (!limit.ok) return httpError(429, "rate limit exceeded", { resetAt: limit.resetAt });

  const url = process.env.CDP_PAYMASTER_URL;
  if (!url) return httpError(503, "paymaster not configured");

  let body: { method?: string } | unknown;
  try {
    body = await req.json();
  } catch {
    return httpError(400, "invalid json");
  }

  const method = (body as { method?: string }).method;
  if (typeof method !== "string" || !ALLOWED.has(method)) {
    return httpError(403, "method not allowed");
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
    return httpError(502, e instanceof Error ? e.message.slice(0, 120) : "upstream error");
  }
}

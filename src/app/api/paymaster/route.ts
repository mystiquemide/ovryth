import { NextResponse } from "next/server";
import { clientIp, httpError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;

// Only allow the JSON-RPC methods the Base Account onboarding flow needs. This keeps
// the upstream CDP endpoint (which embeds a client key) server-side and prevents the
// proxy from becoming a generic JSON-RPC relay.
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

type RpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown[];
};

function noStore(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("cache-control", "no-store");
  return headers;
}

function isRpcRequest(value: unknown): value is RpcRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.jsonrpc !== "2.0" || typeof candidate.method !== "string") return false;
  if (candidate.params !== undefined && !Array.isArray(candidate.params)) return false;
  if (
    candidate.id !== undefined &&
    candidate.id !== null &&
    typeof candidate.id !== "string" &&
    typeof candidate.id !== "number"
  ) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  const limit = rateLimit(`paymaster:${clientIp(req)}`, 60, 60 * 1000);
  if (!limit.ok) return httpError(429, "rate limit exceeded", { resetAt: limit.resetAt });

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return NextResponse.json(
      { error: "content-type must be application/json" },
      { status: 415, headers: noStore() },
    );
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "request body too large" }, { status: 413, headers: noStore() });
  }

  const url = process.env.CDP_PAYMASTER_URL;
  if (!url) return httpError(503, "paymaster not configured");

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "could not read request body" }, { status: 400, headers: noStore() });
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "request body too large" }, { status: 413, headers: noStore() });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: noStore() });
  }

  if (!isRpcRequest(body)) {
    return NextResponse.json({ error: "invalid JSON-RPC request" }, { status: 400, headers: noStore() });
  }
  if (!ALLOWED.has(body.method)) {
    return NextResponse.json({ error: "method not allowed" }, { status: 403, headers: noStore() });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
      cache: "no-store",
    });
    const text = await upstream.text();
    const headers = noStore({ "content-type": upstream.headers.get("content-type") ?? "application/json" });
    return new NextResponse(text, { status: upstream.status, headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message.slice(0, 120) : "upstream error" },
      { status: 502, headers: noStore() },
    );
  }
}

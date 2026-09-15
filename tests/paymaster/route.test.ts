import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/paymaster/route";

const URL = "https://paymaster.example/rpc/key";

function request(body: unknown, headers: Record<string, string> = {}, ip = crypto.randomUUID()) {
  return new Request("http://localhost/api/paymaster", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("paymaster proxy", () => {
  beforeEach(() => {
    process.env.CDP_PAYMASTER_URL = URL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x2105" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CDP_PAYMASTER_URL;
  });

  it("forwards an allowed JSON-RPC request and disables caching", async () => {
    const body = { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] };
    const res = await POST(request(body));

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetch).toHaveBeenCalledOnce();
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: "0x2105" });
  });

  it("rejects JSON-RPC batches", async () => {
    const res = await POST(request([{ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }]));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-allowlisted methods", async () => {
    const res = await POST(request({ jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [] }));
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON-RPC envelopes", async () => {
    const res = await POST(request({ jsonrpc: "1.0", id: 1, method: "eth_chainId", params: {} }));
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects oversized declared request bodies before forwarding", async () => {
    const res = await POST(
      request(
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        { "content-length": String(128 * 1024 + 1) },
      ),
    );
    expect(res.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires JSON content type", async () => {
    const res = await POST(
      request(
        { jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] },
        { "content-type": "text/plain" },
      ),
    );
    expect(res.status).toBe(415);
    expect(fetch).not.toHaveBeenCalled();
  });
});

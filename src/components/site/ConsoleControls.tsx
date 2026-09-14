"use client";

import { useRef, useState } from "react";
import { getAddress, toHex } from "viem";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { AddressDisplay } from "@/components/ui/AddressDisplay";

type Provider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

function ownerMessage(action: string, slug: string, issuedAt: string) {
  return ["Ovryth room authorization", `action: ${action}`, `resource: ${slug}`, `issuedAt: ${issuedAt}`].join("\n");
}

export function ConsoleControls({
  slug,
  ownerAccount,
  status,
  memberCapUsdc,
  freeText,
  rulesVersion,
}: {
  slug: string;
  ownerAccount: string;
  status: string;
  memberCapUsdc: number;
  freeText: string;
  rulesVersion: number;
}) {
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState(status);
  const [cap, setCap] = useState(memberCapUsdc);
  const [text, setText] = useState(freeText);
  const [version, setVersion] = useState(rulesVersion);

  const isOwner = account != null && getAddress(account) === getAddress(ownerAccount);
  const paused = roomStatus === "paused";

  const providerRef = useRef<Provider | null>(null);
  async function getProvider(): Promise<Provider> {
    if (providerRef.current) return providerRef.current;
    const { createBaseAccountSDK } = await import("@base-org/account/browser");
    providerRef.current = createBaseAccountSDK({
      appName: "Ovryth",
      // Route sponsorship through our own proxy so the CDP key stays server-side.
      paymasterUrls: { 8453: `${window.location.origin}/api/paymaster` },
    }).getProvider() as unknown as Provider;
    return providerRef.current;
  }

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const provider = await getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(getAddress(accounts[0]));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    try {
      await providerRef.current?.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {
      /* best-effort revoke; local state clears regardless */
    }
    providerRef.current = null;
    setAccount(null);
    setError(null);
    setNotice(null);
  }

  async function sign(action: string): Promise<{ ownerSignature: string; issuedAt: string }> {
    const provider = await getProvider();
    const issuedAt = new Date().toISOString();
    const ownerSignature = (await provider.request({ method: "personal_sign", params: [toHex(ownerMessage(action, slug, issuedAt)), account!] })) as string;
    return { ownerSignature, issuedAt };
  }

  async function togglePause() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { ownerSignature, issuedAt } = await sign("pause");
      const res = await fetch(`/api/rooms/${slug}/pause`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !paused, ownerSignature, issuedAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      setRoomStatus(json.status);
      setNotice(json.status === "paused" ? "Room paused." : "Room resumed.");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRules() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { ownerSignature, issuedAt } = await sign("update-rules");
      const res = await fetch(`/api/rooms/${slug}/rules`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: { memberWeeklyCapUsdc: cap, freeText: text.trim() }, ownerSignature, issuedAt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      setVersion(json.version);
      setNotice(`Rules saved as v${json.version}.`);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <div className="rounded-card border border-mist bg-snow px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14px] text-smoke">Connect the room owner account to manage this room.</span>
          <Button onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect owner account"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-mist bg-snow px-4 py-3">
        <span className="text-[13px] text-smoke">Connected</span>
        <div className="flex items-center gap-3">
          <AddressDisplay value={account} />
          <button
            type="button"
            onClick={disconnect}
            className="inline-flex min-h-[36px] items-center rounded-pill border border-mist px-3 text-[13px] text-smoke transition-colors hover:border-ink/40 hover:text-ink"
          >
            Disconnect
          </button>
        </div>
      </div>

      {!isOwner && (
        <StatusBanner tone="warn" title="Not the owner">This account is not the room owner, so signed actions will be rejected.</StatusBanner>
      )}
      {error && <StatusBanner tone="warn" title="Something went wrong">{error}</StatusBanner>}
      {notice && <StatusBanner tone="paid" title="Done">{notice}</StatusBanner>}

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-mist bg-paper p-5">
        <div className="mr-auto">
          <div className="text-[15px] font-semibold text-ink">{paused ? "Room is paused" : "Room is active"}</div>
          <div className="text-[13px] text-smoke">{paused ? "No new contributions are scored until you resume." : "Pause to stop scoring new contributions."}</div>
        </div>
        <Button variant={paused ? "primary" : "secondary"} onClick={togglePause} disabled={busy || !isOwner}>{paused ? "Resume room" : "Pause room"}</Button>
      </div>

      <div className="rounded-card border border-mist bg-paper p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="h3">Edit rules</h3>
          <span className="mono text-[12px] text-fog">current v{version}</span>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Member weekly cap (USDC)</span>
          <input type="number" min={1} className={inputCls + " mono"} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">What we value / what we refuse</span>
          <textarea className={inputCls + " min-h-24"} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <Button onClick={saveRules} disabled={busy || !isOwner}>{busy ? "Saving…" : "Save rules"}</Button>
      </div>
    </div>
  );
}

const inputCls = "mb-4 w-full rounded-[10px] border border-mist bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-electric focus:ring-2 focus:ring-electric/30";

function msg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message).slice(0, 200);
  return String(e).slice(0, 200);
}

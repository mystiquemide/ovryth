"use client";

import { useRef, useState } from "react";
import { getAddress } from "viem";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { baseScanTx } from "@/lib/format";
import { friendlyError } from "@/lib/ui-error";

type Provider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

interface SdkPermission {
  signature: string;
  chainId?: number;
  permission: { account: string; spender: string; token: string; allowance: string; period: number; start: number; end: number; salt: string; extraData: string };
}

export function RevokePermission({
  slug,
  ownerAccount,
  sdkPermission,
  revoked,
  revokedTxHash,
}: {
  slug: string;
  ownerAccount: string;
  sdkPermission: SdkPermission;
  revoked: boolean;
  revokedTxHash: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneHash, setDoneHash] = useState<string | null>(revokedTxHash);
  const [isRevoked, setIsRevoked] = useState(revoked);
  const providerRef = useRef<Provider | null>(null);

  async function getProvider(): Promise<Provider> {
    if (providerRef.current) return providerRef.current;
    const { createBaseAccountSDK } = await import("@base-org/account/browser");
    providerRef.current = createBaseAccountSDK({
      appName: "Ovryth",
      appLogoUrl: `${window.location.origin}/apple-touch-icon.png`,
      paymasterUrls: { 8453: `${window.location.origin}/api/paymaster` },
    }).getProvider() as unknown as Provider;
    return providerRef.current;
  }

  async function confirmOnce(): Promise<string | null> {
    const res = await fetch(`/api/rooms/${slug}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const json = await res.json();
    if (res.ok) return (json.txHash as string) ?? "";
    if (res.status === 409) return null; // revoke tx not mined yet
    throw new Error(json.error ?? "could not confirm the revoke");
  }

  async function revoke() {
    setError(null);
    setBusy(true);
    try {
      const provider = await getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (getAddress(accounts[0]) !== getAddress(ownerAccount)) {
        throw new Error(`Connected account is not the room owner. Expected ${ownerAccount}.`);
      }
      const { requestRevoke } = await import("@base-org/account/spend-permission/browser");
      // wallet_sendCalls resolves to a call-bundle id, not a tx hash — poll until the
      // revoke lands on chain and let the API discover the real hash from the event.
      await requestRevoke({ provider: provider as never, permission: sdkPermission as never });

      const deadline = Date.now() + 90_000;
      let hash: string | null = null;
      while (Date.now() < deadline) {
        hash = await confirmOnce();
        if (hash !== null) break;
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (hash === null) throw new Error("Revoke was sent but hasn't landed on chain yet. Refresh this page in a minute and it will show as revoked.");
      setDoneHash(hash || null);
      setIsRevoked(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (isRevoked) {
    return (
      <div className="mt-3">
        <StatusBanner
          tone="revoked"
          title="Revoked"
          action={doneHash ? <a className="text-[13px] text-link hover:underline" href={baseScanTx(doneHash)} target="_blank" rel="noreferrer">View tx ↗</a> : undefined}
        >
          The spend permission is revoked. Ovryth has stopped and can no longer move funds.
        </StatusBanner>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {error && <div className="mb-3"><StatusBanner tone="warn" title="Something went wrong">{error}</StatusBanner></div>}
      <Button variant="secondary" onClick={revoke} disabled={busy}>
        {busy ? "Revoking…" : "Revoke permission"}
      </Button>
      <p className="mt-2 text-[12px] text-fog">
        Connects the room owner account and asks it to sign the revoke. One transaction, gas paid by the account.
      </p>
    </div>
  );
}


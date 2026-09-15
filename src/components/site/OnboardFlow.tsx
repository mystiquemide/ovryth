"use client";

import { useEffect, useRef, useState } from "react";
import { getAddress, toHex, type Hex } from "viem";
import { Button } from "@/components/ui/Button";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { computePermissionHash, type SpendPermission } from "@/lib/chain/permission";
import { PAYER_ADDRESS, USDC, CHAIN_ID } from "@/lib/chain/config";
import { friendlyError } from "@/lib/ui-error";

type Step = "connect" | "budget" | "rules" | "link" | "done";
type Provider = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const BASE_HEX = "0x2105"; // 8453

interface SdkPermission {
  signature: string;
  chainId?: number;
  permission: { account: string; spender: string; token: string; allowance: string; period: number; start: number; end: number; salt: string; extraData: string };
}

function ownerMessage(hash: string, issuedAt: string) {
  return ["Ovryth room authorization", "action: create-room", `resource: ${hash}`, `issuedAt: ${issuedAt}`].join("\n");
}

// The hosted "Allow Spend Permission" consent screen is the only way Coinbase lets a
// spend permission get approved: it refuses sendCalls that target the SpendPermission
// Manager directly, and it doesn't honor an app-supplied paymaster for this step. The
// account pays gas once here; after that payouts are operator-funded and gasless.
async function requestPermission(provider: Provider, account: string, allowance: number): Promise<SdkPermission> {
  const { requestSpendPermission } = await import("@base-org/account/spend-permission/browser");
  return (await requestSpendPermission({
    provider: provider as never,
    account,
    spender: PAYER_ADDRESS!,
    token: USDC,
    chainId: CHAIN_ID,
    allowance: BigInt(Math.round(allowance * 1_000_000)),
    periodInDays: 7,
    end: new Date(Date.now() + 90 * 86_400_000),
  })) as unknown as SdkPermission;
}

export function OnboardFlow() {
  const [step, setStep] = useState<Step>("connect");
  const [account, setAccount] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [allowance, setAllowance] = useState(100);
  const [memberCap, setMemberCap] = useState(25);
  const [freeText, setFreeText] = useState("");

  const [permission, setPermission] = useState<SdkPermission | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const providerRef = useRef<Provider | null>(null);

  async function getProvider(): Promise<Provider> {
    if (providerRef.current) return providerRef.current;
    const { createBaseAccountSDK } = await import("@base-org/account/browser");
    const sdk = createBaseAccountSDK({
      appName: "Ovryth",
      appLogoUrl: `${window.location.origin}/apple-touch-icon.png`,
      // Route sponsorship through our own proxy so the CDP key stays server-side.
      paymasterUrls: { [CHAIN_ID]: `${window.location.origin}/api/paymaster` },
    });
    providerRef.current = sdk.getProvider() as unknown as Provider;
    return providerRef.current;
  }

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      const provider = await getProvider();
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      setAccount(getAddress(accounts[0]));
      setWrongNetwork(chainId !== BASE_HEX);
      setStep("budget");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function switchToBase() {
    try {
      const provider = await getProvider();
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_HEX }] });
      setWrongNetwork(false);
    } catch (e) {
      setError(friendlyError(e));
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
    setPermission(null);
    setSlug(null);
    setLinkCode(null);
    setWrongNetwork(false);
    setError(null);
    setStep("connect");
  }

  async function signPermission() {
    if (!account) return;
    setError(null);
    setBusy(true);
    try {
      const provider = await getProvider();
      setPermission(await requestPermission(provider, account, allowance));
      setStep("rules");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    if (!account || !permission) return;
    if (!name.trim() || !tokenSymbol.trim()) {
      setError("Add a room name and token symbol.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const parsed: SpendPermission = {
        account: getAddress(permission.permission.account),
        spender: getAddress(permission.permission.spender),
        token: getAddress(permission.permission.token),
        allowance: BigInt(permission.permission.allowance),
        period: Number(permission.permission.period),
        start: Number(permission.permission.start),
        end: Number(permission.permission.end),
        salt: BigInt(permission.permission.salt),
        extraData: (permission.permission.extraData || "0x") as Hex,
      };
      const hash = computePermissionHash(parsed);
      const issuedAt = new Date().toISOString();
      const provider = await getProvider();
      const ownerSignature = (await provider.request({
        method: "personal_sign",
        params: [toHex(ownerMessage(hash, issuedAt)), account],
      })) as string;

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          tokenSymbol: tokenSymbol.trim(),
          permission,
          rules: { memberWeeklyCapUsdc: memberCap, freeText: freeText.trim() },
          ownerSignature,
          issuedAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "create failed");
      setSlug(json.slug);
      setLinkCode(json.linkCode);
      setStep("link");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  // Poll for the group binding once we are on the link step.
  useEffect(() => {
    if (step !== "link" || !slug) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${slug}`);
        if (res.ok) {
          const json = await res.json();
          if (json.room?.linked) {
            setStep("done");
            clearInterval(id);
          }
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [step, slug]);

  return (
    <div className="mx-auto max-w-[560px]">
      <Stepper step={step} />

      {error && (
        <div className="mb-6"><StatusBanner tone="warn" title="Something went wrong">{error}</StatusBanner></div>
      )}

      {step === "connect" && (
        <Card title="Connect your Base Account" body="A Base Account is a smart wallet that holds the weekly budget and signs a spend permission naming the Ovryth agent the only spender. Plain EOAs can't do this, which is why a Base Account is required.">
          <ol className="mb-6 space-y-2 text-[14px] text-smoke">
            {["Connect your Base Account", "Set a weekly USDC cap", "Sign the spend permission", "Link your Telegram group"].map((s, i) => (
              <li key={s} className="flex gap-2.5"><span className="mono text-fog">{i + 1}.</span>{s}</li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect Base Account"}</Button>
            <a href="/room" className="inline-flex min-h-[44px] items-center text-[14px] text-link hover:underline">View the live room →</a>
          </div>
          <p className="mt-4 text-[13px] text-fog">Just looking? The live room shows a real weekly cap, payouts, and refusals on Base mainnet.</p>
        </Card>
      )}

      {step !== "connect" && account && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-mist bg-snow px-4 py-3">
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
      )}

      {wrongNetwork && (
        <div className="mb-6">
          <StatusBanner tone="warn" title="Wrong network" action={<Button variant="secondary" onClick={switchToBase}>Switch to Base</Button>}>
            Spend permissions live on Base mainnet (chain id 8453).
          </StatusBanner>
        </div>
      )}

      {step === "budget" && (
        <Card title="Set the weekly budget" body="Fund a weekly allowance in your own account. The permission names the Ovryth payer as the only spender, and it can never exceed this cap. It registers on chain with the first payout.">
          <Field label="Room name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme community" /></Field>
          <Field label="Token symbol"><input className={inputCls} value={tokenSymbol} onChange={(e) => setTokenSymbol(e.target.value)} placeholder="ACME" /></Field>
          <Field label="Weekly allowance (USDC)"><input type="number" min={10} max={5000} className={`${inputCls} mono`} value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} /></Field>
          <div className="mono mb-4 text-[12px] text-fog">spender: {PAYER_ADDRESS?.slice(0, 10)}… · period: 7 days · end: 90 days</div>
          <Button onClick={signPermission} disabled={busy || wrongNetwork}>{busy ? "Awaiting signature…" : "Sign permission"}</Button>
        </Card>
      )}

      {step === "rules" && (
        <Card title="Set the rules" body="Members are paid within these ranges: support 0.50 to 3, translation 2 to 10, guide 5 to 25 USDC. Add your own note on what counts as work.">
          <Field label="Member weekly cap (USDC)"><input type="number" min={1} className={`${inputCls} mono`} value={memberCap} onChange={(e) => setMemberCap(Number(e.target.value))} /></Field>
          <Field label="What we value / what we refuse"><textarea className={`${inputCls} min-h-24`} maxLength={2000} value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="We pay for correct answers, accurate translations, and usable guides. No hype, no filler, no copies." /></Field>
          <Button onClick={createRoom} disabled={busy}>{busy ? "Creating room…" : "Open room"}</Button>
        </Card>
      )}

      {step === "link" && slug && (
        <Card title="Link your Telegram group" body="Add the Ovryth bot to your group as an admin, then send the command below in the group. This page updates the moment the bot links.">
          <a
            href="https://t.me/Ovryth_bot"
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-flex min-h-[44px] items-center rounded-pill border border-electric/40 bg-snow px-4 text-[14px] font-medium text-link hover:underline"
          >
            Open @Ovryth_bot in Telegram ↗
          </a>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-mist bg-snow p-4">
            <div>
              <div className="eyebrow mb-1 text-fog">Send in your group</div>
              <code className="mono text-[15px] text-ink">/link {linkCode}</code>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`/link ${linkCode}`)}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-pill border border-mist px-3 text-[13px] text-smoke transition-colors hover:border-ink/40 hover:text-ink"
            >
              Copy
            </button>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-smoke">
            <span className="h-2 w-2 animate-pulse rounded-pill bg-electric" />
            Waiting for the bot to link…
          </div>
        </Card>
      )}

      {step === "done" && slug && (
        <Card title="Room is live" body="The agent is now watching your group. The first real contribution gets paid within minutes.">
          <div className="space-y-2">
            <a href={`/r/${slug}`} className="block text-[14px] text-link hover:underline">Public room page →</a>
            <a href={`/console/${slug}`} className="block text-[14px] text-link hover:underline">Owner console →</a>
          </div>
        </Card>
      )}
    </div>
  );
}

const inputCls = "mb-4 w-full rounded-[10px] border border-mist bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-electric focus:ring-2 focus:ring-electric/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Card({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-mist bg-paper p-7">
      <h2 className="h3">{title}</h2>
      <p className="mt-2 mb-6 text-[15px] leading-relaxed text-smoke">{body}</p>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["connect", "budget", "rules", "link", "done"];
  const idx = steps.indexOf(step);
  const labels = ["Connect", "Budget", "Rules", "Link", "Done"];
  return (
    <div className="mb-8" aria-label={`Step ${idx + 1} of ${steps.length}: ${labels[idx]}`}>
      <p className="mono mb-3 text-[12px] text-fog sm:hidden">Step {idx + 1} of {steps.length} — {labels[idx]}</p>
      <div className="flex items-center gap-2">
        {labels.map((l, i) => (
          <div key={l} className="flex items-center gap-2">
            <span className={`mono flex h-6 w-6 items-center justify-center rounded-pill text-[12px] ${i <= idx ? "bg-ink text-white" : "bg-snow text-fog"}`}>{i + 1}</span>
            <span className={`hidden text-[13px] sm:inline ${i <= idx ? "text-ink" : "text-fog"}`}>{l}</span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-4 bg-mist" />}
          </div>
        ))}
      </div>
    </div>
  );
}


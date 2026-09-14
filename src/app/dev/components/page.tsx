import { BudgetBar } from "@/components/BudgetBar";
import { VerdictRow } from "@/components/VerdictRow";
import { PermissionCard } from "@/components/PermissionCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Pill, VerdictPill } from "@/components/ui/Pill";
import { AmountDisplay } from "@/components/ui/AmountDisplay";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Mark, Wordmark } from "@/components/ui/Logo";

export const metadata = { title: "Ovryth components", robots: { index: false } };

// Real on-chain values from Ovryth's Base mainnet test payouts (no mock data).
const PAYER = "0x485457f86fbf5e2385ae183bd5518c7d965e3999";
const MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";
const ACCOUNT = "0x708f281Ada585D116e57aCF650cb28B84e972996";
const TX_PAID = "0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270";
const TX_REVERT = "0x2a0e8147e07e9685d8a03443e86a7f605074d889a9d58361e7cb293d2429436b";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-mist py-12">
      <div className="eyebrow mb-6">{title}</div>
      {children}
    </section>
  );
}

export default function ComponentsGallery() {
  return (
    <main id="main-content" className="mx-auto max-w-[1064px] px-6 py-16">
      <p className="eyebrow">Ovryth design system</p>
      <h1 className="h-display mt-2">Components</h1>
      <p className="body-lg mt-4 max-w-2xl text-smoke">
        Every element rendered with real on-chain values from Ovryth&apos;s Base mainnet payouts. No mock data, no
        placeholders.
      </p>

      <Section title="Brand / logo">
        <div className="flex flex-wrap items-end gap-10">
          <div className="flex items-center gap-6">
            <Mark size={56} />
            <Mark size={40} />
            <Mark size={28} />
            <Mark size={16} />
          </div>
          <Wordmark size={32} />
        </div>
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-3 rounded-card border border-mist bg-paper px-5 py-4">
            <Wordmark size={28} />
            <span className="text-[13px] text-fog">on paper</span>
          </div>
          <div className="flex items-center gap-3 rounded-card bg-midnight px-5 py-4">
            <span className="inline-flex items-center gap-2">
              <Mark size={28} />
              <span className="text-[18px] font-semibold tracking-[-0.03em] text-white">Ovryth</span>
            </span>
            <span className="text-[13px] text-white/50">on midnight</span>
          </div>
        </div>
        <p className="mt-4 text-[13px] text-smoke">The mark is the BudgetBar in miniature: a bounded track, a paid fill, the cap line at the right edge.</p>
      </Section>

      <Section title="Typography">
        <div className="space-y-3">
          <div className="h-display">Pay members for real work</div>
          <div className="h1">Never past your weekly cap</div>
          <div className="h2">The budget lives in your own Base Account</div>
          <div className="h3">Refused in public, with a reason</div>
          <p className="body-lg text-smoke">Body large, Open Runde 500, for sub-headlines and lead paragraphs.</p>
          <p className="text-[16px] text-ink">Body, 16px. The quick brown fox settled the invoice in 1.2 seconds.</p>
          <p className="mono text-[14px] text-ink">mono 2.50 USDC · 0xAbcd…43e9 · Mon 00:00 UTC</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Open a room</Button>
          <Button variant="secondary">Sign permission</Button>
          <Button variant="ghost">See the demo room →</Button>
          <ButtonLink variant="primary" href="/dev/components">Primary link</ButtonLink>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Verdict pills & meta">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictPill kind="paid">paid</VerdictPill>
          <VerdictPill kind="refused">refused</VerdictPill>
          <VerdictPill kind="hold">held</VerdictPill>
          <VerdictPill kind="revoked">revoked</VerdictPill>
          <VerdictPill kind="info">pending</VerdictPill>
          <Pill>translation</Pill>
          <Pill>seeded</Pill>
        </div>
      </Section>

      <Section title="Amount & address">
        <div className="flex flex-wrap items-center gap-6">
          <AmountDisplay usdc={2.5} paid />
          <AmountDisplay usdc={12} />
          <AmountDisplay usdc={null} />
          <AddressDisplay value={ACCOUNT} />
          <AddressDisplay value={TX_PAID} kind="hash" />
        </div>
      </Section>

      <Section title="BudgetBar · the identity object">
        <div className="space-y-10">
          <div>
            <div className="mb-3 text-[13px] text-smoke">Active week: paid segments, a hold, refusal ticks, an over-cap revert</div>
            <BudgetBar
              capUsdc={5}
              segments={[{ amountUsdc: 0.25, txHash: TX_PAID }, { amountUsdc: 0.25 }, { amountUsdc: 1.5 }]}
              holds={[{ amountUsdc: 0.5 }]}
              refusals={[{ atFraction: 0.12 }, { atFraction: 0.28 }, { atFraction: 0.66 }]}
              reverted
              resetLabel="resets Mon 00:00 UTC"
            />
          </div>
          <div>
            <div className="mb-3 text-[13px] text-smoke">Empty room</div>
            <BudgetBar capUsdc={5} segments={[]} resetLabel="first real contribution gets paid" />
          </div>
          <div>
            <div className="mb-3 text-[13px] text-smoke">Revoked room</div>
            <BudgetBar capUsdc={5} segments={[]} revoked resetLabel="revoked" />
          </div>
        </div>
      </Section>

      <Section title="VerdictRow · the ledger">
        <div>
          <VerdictRow row={{ time: "Mon 14:02", member: "@ava", category: "support", amountUsdc: 0.25, reason: "Answered how to bridge USDC to Base with the exact steps and cost.", kind: "paid", txHash: TX_PAID }} />
          <VerdictRow row={{ time: "Mon 14:05", member: "@ava2", category: null, amountUsdc: null, reason: "copy of an earlier message", kind: "refused", seeded: true }} />
          <VerdictRow row={{ time: "Mon 15:20", member: "@newcomer", category: "translation", amountUsdc: null, reason: "approved, waiting on a linked wallet", kind: "hold" }} />
          <VerdictRow row={{ time: "Tue 09:11", member: "@lena", category: "guide", amountUsdc: 12, reason: "Wrote the step-by-step for signing a spend permission.", kind: "paid", txHash: TX_PAID, editedAfterPayment: true }} />
        </div>
      </Section>

      <Section title="PermissionCard">
        <div className="max-w-md">
          <PermissionCard
            account={ACCOUNT}
            spender={PAYER}
            managerAddress={MANAGER}
            allowanceUsdc={5}
            remainingUsdc={3.0}
            nextReset="Mon 00:00 UTC"
            endDate="90 days"
            status="active"
          />
        </div>
      </Section>

      <Section title="Status banners & empty state">
        <div className="space-y-4">
          <StatusBanner tone="warn" title="Paused" action={<Button variant="secondary">Resume</Button>}>
            This room is paused. No new contributions are scored until you resume.
          </StatusBanner>
          <StatusBanner tone="revoked" title="Revoked" action={<a className="text-[13px] text-link hover:underline" href={`https://basescan.org/tx/${TX_REVERT}`} target="_blank" rel="noreferrer">View tx ↗</a>}>
            The spend permission was revoked. Ovryth has stopped and can no longer move funds.
          </StatusBanner>
          <EmptyState action={<Button variant="primary">Open a room</Button>}>
            No payouts yet this week. Rules are live. First real contribution gets paid.
          </EmptyState>
        </div>
      </Section>
    </main>
  );
}

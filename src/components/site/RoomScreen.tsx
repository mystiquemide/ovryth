import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { BudgetBar } from "@/components/BudgetBar";
import { PermissionCard } from "@/components/PermissionCard";
import { RulesPanel } from "@/components/RulesPanel";
import { RoomLedgerTabs } from "@/components/RoomLedgerTabs";
import { TelegramThread } from "@/components/TelegramThread";
import { VerdictPill, Pill, type VerdictKind } from "@/components/ui/Pill";
import { formatUsdcAmount, baseScanTx, baseScanAddress, shortHash } from "@/lib/format";
import type { RoomView } from "@/lib/room-view";

const BOT_URL = "https://t.me/Ovryth_bot";

const STATUS: Record<string, { kind: VerdictKind; word: string }> = {
  active: { kind: "paid", word: "active" },
  paused: { kind: "info", word: "paused" },
  pending_onchain: { kind: "info", word: "pending" },
  inactive_bot: { kind: "info", word: "bot removed" },
  revoked: { kind: "revoked", word: "revoked" },
  expired: { kind: "revoked", word: "expired" },
};

const STEPS = [
  ["1", "Join this Telegram group", "Ovryth is an admin there, reading messages and paying for real work."],
  ["2", "DM the bot your wallet", "Send /wallet 0x… once. That address is where your USDC lands."],
  ["3", "Answer a pinned question", "Post a real, substantive answer to one of the questions below."],
  ["4", "Get paid within minutes", "Ovryth replies with the amount, the reason, and a BaseScan link."],
  ["5", "Try to farm it", "Copy the answer from a second account. It gets refused in public."],
];

export function RoomScreen({ room }: { room: RoomView }) {
  const status = STATUS[room.status] ?? { kind: "info" as VerdictKind, word: room.status };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1064px] px-6 py-12">
        <header className="border-b border-mist pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="h2">{room.name}</h1>
            <Pill>${room.tokenSymbol}</Pill>
            <VerdictPill kind={status.kind}>{status.word}</VerdictPill>
            {room.seeded && <Pill>seeded room</Pill>}
            {room.external && <Pill>external room</Pill>}
          </div>
          {room.permission && (
            <a href={baseScanAddress(room.permission.manager)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] text-electric hover:underline">
              Verify the spend permission on BaseScan ↗
            </a>
          )}
        </header>

        <section className="border-b border-mist py-10">
          <p className="eyebrow">Get paid in two minutes</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
            <ol className="space-y-5">
              {STEPS.map(([n, title, body]) => (
                <li key={n} className="flex gap-4">
                  <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-mist bg-paper text-[14px] text-ink">{n}</span>
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-smoke">{body}</p>
                  </div>
                </li>
              ))}
              <li className="flex gap-4">
                <span className="h-8 w-8 shrink-0" />
                <a href={BOT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-pill bg-midnight px-[18px] py-[11px] text-[14px] font-medium text-white shadow-[var(--shadow-button)] transition-colors hover:bg-carbon">Open @Ovryth_bot →</a>
              </li>
            </ol>
            <div className="space-y-6">
              {room.questions.length > 0 && (
                <div className="rounded-card border border-mist bg-paper p-5">
                  <div className="eyebrow mb-3 text-fog">Pinned questions</div>
                  <ul className="space-y-3">
                    {room.questions.map((q, i) => (
                      <li key={i} className="flex gap-2.5 text-[14px] text-ink"><span className="mono text-electric">#</span><span>{q}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              <TelegramThread paidTxHash={room.proof.latestPayoutTx} paidAmount={room.proof.examplePaidAmount} />
            </div>
          </div>
        </section>

        <section className="border-b border-mist py-10">
          <div className="flex items-baseline justify-between">
            <h2 className="h3">This week</h2>
            <span className="mono text-[13px] text-fog">all-time paid {formatUsdcAmount(room.totals.paidUsdc)} USDC · {room.totals.payoutCount} payouts · {room.totals.refusalCount} refusals</span>
          </div>
          <div className="mt-5">
            <BudgetBar
              capUsdc={room.budget.capUsdc}
              segments={room.budget.segments}
              refusals={room.budget.refusals}
              reverted={room.budget.reverted}
              revoked={room.budget.revoked}
              resetLabel={room.budget.resetLabel}
            />
          </div>
        </section>

        <section className="grid gap-6 border-b border-mist py-10 md:grid-cols-2">
          {room.permission && (
            <PermissionCard
              account={room.permission.account}
              spender={room.permission.spender}
              managerAddress={room.permission.manager}
              allowanceUsdc={room.permission.allowanceUsdc}
              remainingUsdc={room.permission.remainingUsdc}
              nextReset={room.permission.nextReset}
              endDate={room.permission.endDate}
              status={room.permission.status}
            />
          )}
          {room.rules && <RulesPanel rules={room.rules} />}
        </section>

        <section className="border-b border-mist py-10">
          <h2 className="h3 mb-4">Ledger</h2>
          <RoomLedgerTabs paid={room.paidRows} refused={room.refusedRows} />
        </section>

        <section className="py-10">
          <h2 className="h3 mb-4">Proof</h2>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[14px]">
            {room.proof.latestPayoutTx && (
              <a href={baseScanTx(room.proof.latestPayoutTx)} target="_blank" rel="noreferrer" className="mono text-electric hover:underline">latest payout {shortHash(room.proof.latestPayoutTx)} ↗</a>
            )}
            {room.proof.latestRevertTx && (
              <a href={baseScanTx(room.proof.latestRevertTx)} target="_blank" rel="noreferrer" className="mono text-electric hover:underline">over-cap revert {shortHash(room.proof.latestRevertTx)} ↗</a>
            )}
            <a href={`${baseScanAddress(room.proof.payer)}#code`} target="_blank" rel="noreferrer" className="text-electric hover:underline">verified payer contract ↗</a>
            <a href="/proof" className="text-electric hover:underline">all proof →</a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

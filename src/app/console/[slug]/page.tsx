import { notFound } from "next/navigation";
import { Nav } from "@/components/site/Nav";
import { BudgetBar } from "@/components/BudgetBar";
import { PermissionCard } from "@/components/PermissionCard";
import { RulesPanel } from "@/components/RulesPanel";
import { RoomLedgerTabs } from "@/components/RoomLedgerTabs";
import { ConsoleControls } from "@/components/site/ConsoleControls";
import { VerdictPill, type VerdictKind } from "@/components/ui/Pill";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { formatUsdcAmount } from "@/lib/format";
import { getRoomView } from "@/lib/room-view";
import { getOperatorNotes } from "@/lib/console";

const STATUS: Record<string, { kind: VerdictKind; word: string }> = {
  active: { kind: "paid", word: "active" },
  paused: { kind: "info", word: "paused" },
  pending_onchain: { kind: "info", word: "pending" },
  inactive_bot: { kind: "info", word: "bot removed" },
  revoked: { kind: "revoked", word: "revoked" },
  expired: { kind: "revoked", word: "expired" },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await getRoomView(slug);
  return { title: room ? `${room.name} console · Ovryth` : "Console · Ovryth" };
}

export default async function ConsolePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [room, notes] = await Promise.all([getRoomView(slug), getOperatorNotes()]);
  if (!room) notFound();
  const status = STATUS[room.status] ?? { kind: "info" as VerdictKind, word: room.status };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1064px] px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-mist pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow text-fog">Owner console</span>
            <h1 className="h2">{room.name}</h1>
            <VerdictPill kind={status.kind}>{status.word}</VerdictPill>
          </div>
          <a href={`/room`} className="text-[13px] text-electric hover:underline">View public room →</a>
        </header>

        <section className="py-8">
          <BudgetBar
            capUsdc={room.budget.capUsdc}
            segments={room.budget.segments}
            refusals={room.budget.refusals}
            reverted={room.budget.reverted}
            revoked={room.budget.revoked}
            resetLabel={room.budget.resetLabel}
          />
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="space-y-8">
            {room.rules && (
              <ConsoleControls
                slug={room.slug}
                ownerAccount={room.permission?.account ?? ""}
                status={room.status}
                memberCapUsdc={room.rules.memberWeeklyCapUsdc}
                freeText={room.rules.freeText}
                rulesVersion={room.rules.version}
              />
            )}

            <section>
              <h2 className="h3 mb-4">Ledger</h2>
              <RoomLedgerTabs paid={room.paidRows} refused={room.refusedRows} />
            </section>
          </div>

          <aside className="space-y-6">
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

            <div className="rounded-card border border-mist bg-paper p-6">
              <h3 className="h3 mb-4">Operator</h3>
              <div className="space-y-2.5 text-[13px]">
                <Row label="Last sweeper tick" value={notes.lastTick ? new Date(notes.lastTick).toLocaleString("en-US", { timeZone: "UTC" }) + " UTC" : "not yet"} />
                <Row label="Pending jobs" value={<span className="mono">{notes.pendingJobs}</span>} />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-smoke">Operator gas</span>
                  <span className="mono text-ink">{notes.operatorGasEth ? `${notes.operatorGasEth} ETH` : "unknown"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-smoke">Operator</span>
                  <AddressDisplay value={notes.operatorAddress} />
                </div>
              </div>
            </div>

            <details className="rounded-card border border-mist bg-paper p-6 text-[13px] text-smoke">
              <summary className="cursor-pointer text-[15px] font-semibold text-ink">Revoke this room</summary>
              <p className="mt-3 leading-relaxed">
                Revoke the spend permission from your Base Account&apos;s permissions screen. It sends one on-chain
                transaction. Ovryth stops immediately and can no longer move any funds. This room then shows as revoked.
              </p>
              <p className="mono mt-3 text-[12px] text-fog">weekly cap {formatUsdcAmount(room.budget.capUsdc)} USDC</p>
            </details>
          </aside>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-smoke">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

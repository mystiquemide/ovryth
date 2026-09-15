import { ButtonLink } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { BudgetBar } from "@/components/BudgetBar";
import { LedgerLegend } from "@/components/LedgerLegend";
import { VerdictRow } from "@/components/VerdictRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { getShowcase } from "@/lib/showcase";
import { SHOWCASE_SLUG } from "@/lib/room-view";
import { EdgeDecor } from "./EdgeDecor";

export async function Hero() {
  const showcase = await getShowcase(SHOWCASE_SLUG);

  return (
    <section className="relative px-6 pt-20 pb-16 md:pt-28">
      <EdgeDecor />
      <div className="relative z-10 mx-auto max-w-[880px] text-center">
        <p className="eyebrow">AI payroll agent</p>
        <h1 className="h-display mt-4">An agent that pays for real work. Never past your cap.</h1>
        <p className="body-lg mx-auto mt-5 max-w-[620px] text-smoke">
          Ovryth is an AI agent that lives in your project&apos;s Telegram. It reads every contribution, pays members
          for real work in USDC within minutes, and refuses duplicate or low-effort posts in public. The budget stays
          in your own Base Account, and the weekly cap is enforced on chain, a line the agent can never cross.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/open" variant="primary">Open a room</ButtonLink>
          <ButtonLink href="/room" variant="secondary">See the room →</ButtonLink>
        </div>
      </div>

      {showcase && (
        <div className="relative z-10 mx-auto mt-14 max-w-[880px]">
          <div className="rounded-panel border border-mist bg-paper p-6 shadow-[var(--shadow-artifact)] md:p-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ink">{showcase.name}</span>
                <Pill>demo room</Pill>
              </div>
              <a href="/room" className="inline-flex min-h-[36px] items-center text-[13px] text-link hover:underline">Open room →</a>
            </div>

            <BudgetBar
              capUsdc={showcase.capUsdc}
              segments={showcase.segments}
              refusals={showcase.refusals}
              reverted={showcase.reverted}
              resetLabel={showcase.resetLabel}
            />
            <LedgerLegend className="mt-3" />
            <p className="mt-3 text-[12px] text-fog">Demo room. Every transaction below is a real Base receipt.</p>

            <div className="mt-6">
              {showcase.rows.length > 0 ? (
                <div>
                  {showcase.rows.map((row, i) => (
                    <VerdictRow key={i} row={row} />
                  ))}
                </div>
              ) : (
                <EmptyState>No payouts yet this week. Rules are live. First real contribution gets paid.</EmptyState>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

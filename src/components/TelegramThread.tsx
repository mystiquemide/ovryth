import { VerdictPill } from "./ui/Pill";
import { formatUsdcAmount, shortHash, baseScanTx } from "@/lib/format";
import { Mark } from "./ui/Logo";

function Avatar({ initial }: { initial: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-snow text-[13px] font-semibold text-smoke">
      {initial}
    </span>
  );
}

function Msg({ initial, handle, children }: { initial: string; handle: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Avatar initial={initial} />
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{handle}</div>
        <div className="mt-0.5 text-[14px] leading-relaxed text-smoke">{children}</div>
      </div>
    </div>
  );
}

function BotReply({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 pl-11">
      <Mark size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-[14px]">{children}</div>
    </div>
  );
}

/** The memorable screenshot, as real UI: a paid answer, then a copied one refused. */
export function TelegramThread({ paidTxHash, paidAmount }: { paidTxHash: string | null; paidAmount: number | null }) {
  const amount = paidAmount ?? 0.25;
  return (
    <div className="rounded-card border border-mist bg-paper p-5 shadow-[var(--shadow-artifact)]">
      <div className="mb-4 flex items-center gap-2 border-b border-mist pb-3 text-[13px] text-fog">
        <span className="font-medium text-ink">Ovryth demo</span>
        <span>· Telegram group</span>
      </div>

      <div className="space-y-4">
        <Msg initial="A" handle="@ava">
          To bridge USDC from Ethereum to Base, use bridge.base.org, connect on Ethereum, pick USDC and confirm. It
          takes about two minutes and only costs Ethereum gas.
        </Msg>
        <BotReply>
          <span className="inline-flex flex-wrap items-center gap-2">
            <VerdictPill kind="paid">paid</VerdictPill>
            <span className="text-ink">
              Paid <span className="mono">{formatUsdcAmount(amount)} USDC</span> for support.
            </span>
            {paidTxHash && (
              <a href={baseScanTx(paidTxHash)} target="_blank" rel="noreferrer" className="mono text-[13px] text-electric hover:underline">
                tx {shortHash(paidTxHash)} ↗
              </a>
            )}
          </span>
        </BotReply>

        <Msg initial="A" handle="@ava_alt">
          To bridge USDC from Ethereum to Base, use bridge.base.org, connect on Ethereum, pick USDC and confirm. It
          takes about two minutes and only costs Ethereum gas.
        </Msg>
        <BotReply>
          <span className="inline-flex flex-wrap items-center gap-2">
            <VerdictPill kind="refused">refused</VerdictPill>
            <span className="text-ink">Not paid: copy of an earlier message.</span>
          </span>
        </BotReply>
      </div>
    </div>
  );
}

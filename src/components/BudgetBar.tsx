import { formatUsdcAmount } from "@/lib/format";

export interface BudgetSegment {
  amountUsdc: number;
  txHash?: string;
}

export interface BudgetBarProps {
  capUsdc: number;
  segments: BudgetSegment[];
  holds?: { amountUsdc: number }[];
  /** Refusal positions across the week, 0 (Mon) to 1 (reset), for the ticks under the bar. */
  refusals?: { atFraction: number }[];
  reverted?: boolean;
  revoked?: boolean;
  revokedTxHash?: string;
  resetLabel: string;
}

/**
 * The identity object: one hairline bar. Left edge is zero, right edge is the weekly cap.
 * Green segments are paid amounts in order, amber hatch is held, rust ticks under the bar are
 * public refusals, and the right edge is the cap. Revoked rooms render in slate.
 */
export function BudgetBar({
  capUsdc,
  segments,
  holds = [],
  refusals = [],
  reverted = false,
  revoked = false,
  resetLabel,
}: BudgetBarProps) {
  const paid = segments.reduce((s, x) => s + x.amountUsdc, 0);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / capUsdc) * 100))}%`;

  return (
    <div className="w-full">
      <div className="relative">
        {/* Track */}
        <div
          className={`relative flex h-5 md:h-7 w-full overflow-hidden rounded-md border ${
            revoked ? "border-mist bg-snow" : "border-mist bg-snow"
          }`}
        >
          {revoked
            ? <div className="h-full w-full bg-revoked/15" />
            : (
              <>
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    className="h-full bg-paid"
                    style={{ width: pct(seg.amountUsdc), marginLeft: i === 0 ? 0 : 1 }}
                    title={`paid ${formatUsdcAmount(seg.amountUsdc)} USDC`}
                  />
                ))}
                {holds.map((h, i) => (
                  <div
                    key={`h${i}`}
                    className="h-full"
                    style={{
                      width: pct(h.amountUsdc),
                      marginLeft: 1,
                      backgroundColor: "var(--color-hold-tint)",
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent 0 4px, rgba(154,106,8,0.45) 4px 5px)",
                    }}
                    title={`held ${formatUsdcAmount(h.amountUsdc)} USDC`}
                  />
                ))}
              </>
            )}
        </div>

        {/* Cap line at the right edge */}
        <div className="absolute right-0 top-[-4px] h-[calc(100%+8px)] w-[2px] bg-ink" aria-hidden />

        {/* Over-cap revert marker just past the cap */}
        {reverted && !revoked && (
          <div className="absolute right-[-2px] top-[-18px] mono text-[11px] text-refused">blocked by cap</div>
        )}

        {/* Refusal ticks under the bar (time axis: Monday to reset) */}
        <div className="relative mt-1 h-2 w-full" aria-hidden>
          {refusals.map((r, i) => (
            <div
              key={i}
              className="absolute top-0 h-2 w-px bg-refused"
              style={{ left: `${Math.max(0, Math.min(100, r.atFraction * 100))}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="mono text-[13px] text-ink">
          {revoked ? (
            <span className="text-revoked">revoked</span>
          ) : (
            <>
              paid this week {formatUsdcAmount(paid)} <span className="text-fog">/ {formatUsdcAmount(capUsdc)} USDC</span>
            </>
          )}
        </span>
        <span className="mono text-[13px] text-fog">{resetLabel}</span>
      </div>
    </div>
  );
}

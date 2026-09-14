import { formatUsdcAmount } from "@/lib/format";

/**
 * Mono, tabular, 2dp amount with a muted USDC suffix. A refusal renders a dash.
 * Paid amounts are green; otherwise ink.
 */
export function AmountDisplay({
  usdc,
  paid = false,
  className = "",
}: {
  usdc: number | null;
  paid?: boolean;
  className?: string;
}) {
  if (usdc == null) {
    return <span className={`mono text-fog ${className}`} aria-label="no amount">-</span>;
  }
  return (
    <span className={`mono tabular-nums ${paid ? "text-paid" : "text-ink"} ${className}`}>
      {formatUsdcAmount(usdc)}
      <span className="text-fog"> USDC</span>
    </span>
  );
}

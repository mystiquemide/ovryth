import { AmountDisplay } from "./ui/AmountDisplay";
import { Pill, VerdictPill } from "./ui/Pill";
import { baseScanTx, shortHash } from "@/lib/format";

export interface VerdictRowData {
  time: string; // e.g. "Mon 14:02"
  member: string; // "@handle"
  category?: string | null; // "translation" | null for refusals
  amountUsdc: number | null; // null => refusal (dash)
  reason: string;
  kind: "paid" | "refused" | "hold";
  txHash?: string;
  editedAfterPayment?: boolean;
  seeded?: boolean;
}

/** The core ledger row. Grid on md, stacks on mobile with amount first. */
export function VerdictRow({ row }: { row: VerdictRowData }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-mist py-3 md:grid-cols-[92px_150px_130px_140px_1fr_120px] md:items-center md:gap-4">
      <span className="mono text-[13px] text-fog">{row.time}</span>

      <span className="text-[14px] text-ink">
        {row.member}
        {row.seeded && <span className="ml-2 align-middle"><Pill>demo</Pill></span>}
      </span>

      <span>
        {row.kind === "paid" && row.category ? (
          <VerdictPill kind="paid">{row.category}</VerdictPill>
        ) : row.kind === "hold" ? (
          <VerdictPill kind="hold">held</VerdictPill>
        ) : (
          <VerdictPill kind="refused">refused</VerdictPill>
        )}
      </span>

      <span className="md:text-right">
        <AmountDisplay usdc={row.amountUsdc} paid={row.kind === "paid"} />
      </span>

      <span className="text-[14px] text-smoke">
        {row.reason}
        {row.editedAfterPayment && <span className="ml-2 text-[12px] text-fog">(edited after payment)</span>}
      </span>

      <span className="md:text-right">
        {row.txHash ? (
          <a
            href={baseScanTx(row.txHash)}
            target="_blank"
            rel="noreferrer"
            className="mono text-[13px] text-link hover:underline"
            title={`View ${shortHash(row.txHash)} on BaseScan`}
          >
            view tx ↗
          </a>
        ) : (
          <span className="text-fog">-</span>
        )}
      </span>
    </div>
  );
}

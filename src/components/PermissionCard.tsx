import { AddressDisplay } from "./ui/AddressDisplay";
import { VerdictPill, type VerdictKind } from "./ui/Pill";
import { formatUsdcAmount, baseScanAddress } from "@/lib/format";

export interface PermissionCardProps {
  account: string;
  spender: string; // OvrythPayer contract
  managerAddress: string; // SpendPermissionManager
  allowanceUsdc: number;
  remainingUsdc: number;
  nextReset: string;
  endDate: string;
  status: "active" | "revoked" | "expired" | "pending";
}

const statusKind: Record<PermissionCardProps["status"], VerdictKind> = {
  active: "paid",
  revoked: "revoked",
  expired: "revoked",
  pending: "info",
};
const statusWord: Record<PermissionCardProps["status"], string> = {
  active: "active",
  revoked: "revoked",
  expired: "expired",
  pending: "pending",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-mist py-2.5 last:border-0">
      <span className="text-[13px] text-smoke">{label}</span>
      <span className="text-[14px] text-ink">{children}</span>
    </div>
  );
}

export function PermissionCard(p: PermissionCardProps) {
  const remainingPct = Math.max(0, Math.min(100, (p.remainingUsdc / p.allowanceUsdc) * 100));
  return (
    <div className="rounded-card border border-mist bg-paper p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="h3">Spend permission</h3>
        <VerdictPill kind={statusKind[p.status]}>{statusWord[p.status]}</VerdictPill>
      </div>

      <Field label="Project account"><AddressDisplay value={p.account} /></Field>
      <Field label="Spender (payer)"><AddressDisplay value={p.spender} /></Field>
      <Field label="Allowance / week"><span className="mono">{formatUsdcAmount(p.allowanceUsdc)} <span className="text-fog">USDC</span></span></Field>

      <div className="border-b border-mist py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] text-smoke">Remaining this period</span>
          <span className="mono text-[13px] text-ink">{formatUsdcAmount(p.remainingUsdc)} <span className="text-fog">/ {formatUsdcAmount(p.allowanceUsdc)}</span></span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-md border border-mist bg-snow">
          <div className="h-full bg-electric" style={{ width: `${remainingPct}%` }} />
        </div>
      </div>

      <Field label="Next reset">{p.nextReset}</Field>
      <Field label="End date">{p.endDate}</Field>

      <div className="mt-4 flex items-center justify-between">
        <a href={baseScanAddress(p.managerAddress)} target="_blank" rel="noreferrer" className="text-[13px] text-electric hover:underline">
          Verify the manager on BaseScan ↗
        </a>
      </div>

      <details className="mt-3 text-[13px] text-smoke">
        <summary className="cursor-pointer text-ink">How to revoke</summary>
        <p className="mt-2 leading-relaxed">
          Revoke any time from your Base Account&apos;s permissions screen. It sends one on-chain transaction; Ovryth stops
          immediately and can no longer move funds. The room page and this card update on the next status check.
        </p>
      </details>
    </div>
  );
}

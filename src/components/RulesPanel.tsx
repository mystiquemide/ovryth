import { formatUsdcAmount } from "@/lib/format";
import type { Category } from "@/lib/room-view";

export interface RulesPanelData {
  version: number;
  categories: Category[];
  memberWeeklyCapUsdc: number;
  roomDailyCapUsdc: number;
  minAccountAgeDays: number;
  minTenureDays: number;
  freeText: string;
}

export function RulesPanel({ rules }: { rules: RulesPanelData }) {
  return (
    <div className="rounded-card border border-mist bg-paper p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="h3">Rules</h3>
        <span className="mono text-[12px] text-fog">v{rules.version}</span>
      </div>

      <div className="divide-y divide-mist">
        {rules.categories.map((c) => (
          <div key={c.key} className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">{c.label}</span>
            <span className="mono text-[13px] text-smoke">
              {formatUsdcAmount(c.minUsdc)} - {formatUsdcAmount(c.maxUsdc)} <span className="text-fog">USDC</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 text-[13px] text-smoke">
        <div>Member weekly cap <span className="mono text-ink">{formatUsdcAmount(rules.memberWeeklyCapUsdc)} USDC</span></div>
        <div>Room daily cap <span className="mono text-ink">{formatUsdcAmount(rules.roomDailyCapUsdc)} USDC</span></div>
        <div>Floors <span className="mono text-ink">{rules.minAccountAgeDays}d account age · {rules.minTenureDays}d room tenure</span></div>
      </div>

      {rules.freeText && (
        <blockquote className="mt-4 border-l-2 border-mist pl-4 text-[14px] leading-relaxed text-smoke">
          {rules.freeText}
        </blockquote>
      )}
    </div>
  );
}

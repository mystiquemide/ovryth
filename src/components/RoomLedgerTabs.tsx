"use client";

import { useState } from "react";
import { VerdictRow, type VerdictRowData } from "./VerdictRow";
import { EmptyState } from "./ui/EmptyState";

export function RoomLedgerTabs({ paid, refused }: { paid: VerdictRowData[]; refused: VerdictRowData[] }) {
  const [tab, setTab] = useState<"paid" | "refused">("paid");
  const rows = tab === "paid" ? paid : refused;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <Tab active={tab === "paid"} onClick={() => setTab("paid")} label="Paid" count={paid.length} />
        <Tab active={tab === "refused"} onClick={() => setTab("refused")} label="Refused" count={refused.length} />
      </div>

      {rows.length > 0 ? (
        <div>{rows.map((r, i) => <VerdictRow key={i} row={r} />)}</div>
      ) : (
        <EmptyState>
          {tab === "paid"
            ? "No payouts yet this week. Rules are live. First real contribution gets paid."
            : "No refusals yet. Low-quality or copied messages will show here with a reason."}
        </EmptyState>
      )}
    </div>
  );
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center rounded-pill px-4 text-[14px] font-medium transition-colors duration-150 ${
        active ? "bg-ink text-white" : "text-smoke hover:bg-snow hover:text-ink"
      }`}
    >
      {label} <span className={active ? "text-white/60" : "text-fog"}>{count}</span>
    </button>
  );
}

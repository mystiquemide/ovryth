const ITEMS: { dot: string; word: string; meaning: string }[] = [
  { dot: "bg-paid", word: "paid", meaning: "real work, USDC sent" },
  { dot: "bg-refused", word: "refused", meaning: "rejected in public" },
  { dot: "bg-hold", word: "held", meaning: "waiting on a check" },
  { dot: "bg-revoked", word: "reverted", meaning: "cap blocked the tx" },
];

/** Compact legend mapping each verdict color to its meaning. */
export function LedgerLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 ${className}`}>
      {ITEMS.map((i) => (
        <li key={i.word} className="flex items-center gap-1.5 text-[12px] text-fog">
          <span className={`h-2 w-2 rounded-pill ${i.dot}`} aria-hidden />
          <span className="font-medium text-smoke">{i.word}</span>
          <span>{i.meaning}</span>
        </li>
      ))}
    </ul>
  );
}

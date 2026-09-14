import type { ReactNode } from "react";

export type VerdictKind = "paid" | "refused" | "hold" | "revoked" | "info";

const styles: Record<VerdictKind, string> = {
  paid: "text-paid bg-paid-tint border-paid/20",
  refused: "text-refused bg-refused-tint border-refused/20",
  hold: "text-hold bg-hold-tint border-hold/20",
  revoked: "text-revoked bg-snow border-mist",
  info: "text-smoke bg-snow border-mist",
};

function Glyph({ kind }: { kind: VerdictKind }) {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": true } as const;
  switch (kind) {
    case "paid":
      return (
        <svg {...common}><path d="M2.5 6.2l2.2 2.2 4.8-4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      );
    case "refused":
      return <svg {...common}><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    case "hold":
      return <svg {...common}><circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.3" /><path d="M6 3.6V6l1.8 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
    case "revoked":
      return <svg {...common}><circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.3" /><path d="M3 3l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
    default:
      return <svg {...common}><circle cx="6" cy="6" r="2.4" fill="currentColor" /></svg>;
  }
}

/** Verdict pill: color is never the only signal - always a glyph + a word. */
export function VerdictPill({ kind, children }: { kind: VerdictKind; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[13px] font-medium ${styles[kind]}`}>
      <Glyph kind={kind} />
      {children}
    </span>
  );
}

/** Neutral category / meta pill. */
export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-pill border border-mist bg-paper px-2.5 py-1 text-[13px] font-medium text-smoke ${className}`}>
      {children}
    </span>
  );
}

/**
 * Ovryth mark: a miniature of the identity object (the BudgetBar) - a bounded track,
 * a paid fill from the left, and the cap line at the right edge. Scales to a favicon.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0d111b" />
      <rect x="6" y="13.5" width="20" height="5" rx="2.5" fill="#ffffff" fillOpacity="0.16" />
      <rect x="6" y="13.5" width="12" height="5" rx="2.5" fill="#0098f2" />
      <rect x="24.5" y="10.5" width="2" height="11" rx="1" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={size} />
      <span className="text-[18px] font-semibold tracking-[-0.03em] text-ink">Ovryth</span>
    </span>
  );
}

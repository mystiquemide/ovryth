import type { ReactNode } from "react";

/** One sentence plus one action. Honest empty state, never a fake row. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-card border border-mist bg-snow px-6 py-8">
      <p className="text-[15px] text-smoke">{children}</p>
      {action}
    </div>
  );
}

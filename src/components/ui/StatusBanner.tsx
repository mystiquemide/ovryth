import type { ReactNode } from "react";

type Tone = "info" | "warn" | "paid" | "revoked";

const tones: Record<Tone, string> = {
  info: "border-mist bg-snow text-ink",
  warn: "border-hold/30 bg-hold-tint text-ink",
  paid: "border-paid/30 bg-paid-tint text-ink",
  revoked: "border-mist bg-snow text-revoked",
};

/** Full-width hairline banner: a word, one sentence, and one relevant link. */
export function StatusBanner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-card border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[14px]">
        <span className="font-semibold">{title}.</span> <span className="text-smoke">{children}</span>
      </div>
      {action}
    </div>
  );
}

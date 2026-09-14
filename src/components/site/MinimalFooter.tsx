import Link from "next/link";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/proof", label: "Proof" },
  { href: "/status", label: "Status" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

/** Compact link strip for focused flows (/open, /console) that drop the full footer. */
export function MinimalFooter() {
  return (
    <footer className="mt-16 border-t border-mist px-6 py-6">
      <nav className="mx-auto flex max-w-[1064px] flex-wrap items-center justify-between gap-4">
        <span className="mono text-[12px] text-fog">Base mainnet · chain id 8453</span>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="inline-flex min-h-[36px] items-center text-[13px] text-smoke transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </footer>
  );
}

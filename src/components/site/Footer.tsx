import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Logo";

const X_URL = "https://x.com/ovryth";
const GITHUB_URL = "https://github.com/mystiquemide/ovryth";

const HONESTY = [
  "Demo accounts are labeled as demo.",
  "Telegram does not expose account age, so it is approximated from the user id and first-seen date.",
  "Spend permissions need a Base Account (smart wallet); plain EOAs are unsupported.",
];

function XMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

function FootLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "inline-flex min-h-[36px] items-center text-[14px] text-smoke transition-colors duration-150 hover:text-ink";
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}

export function Footer() {
  return (
    <>
      {/* Final CTA */}
      <section className="px-6 py-24 text-center md:py-28">
        <div className="mx-auto max-w-[720px]">
          <h2 className="h1">Open a room this week</h2>
          <p className="body-lg mx-auto mt-4 max-w-[520px] text-smoke">
            Fund a weekly cap in your own Base Account, add the agent to your Telegram, and it starts paying members
            for real work within minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/open" variant="primary">Open a room</ButtonLink>
            <ButtonLink href="/room" variant="secondary">See the room →</ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-mist px-6 py-14">
        <div className="mx-auto max-w-[1064px]">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-[320px]">
              <Wordmark size={26} />
              <p className="mt-3 text-[14px] leading-relaxed text-smoke">
                An AI agent that pays for real community work. USDC on Base, capped on chain.
              </p>
              <p className="mono mt-3 text-[12px] text-fog">Base mainnet · chain id 8453</p>
            </div>

            <div className="flex flex-wrap gap-12 md:gap-16">
              <div className="flex flex-col gap-3">
                <div className="eyebrow text-fog">Product</div>
                <FootLink href="/room">Room</FootLink>
                <FootLink href="/onboard">Onboard</FootLink>
                <FootLink href="/open">Open a room</FootLink>
                <FootLink href="/console">Console</FootLink>
              </div>
              <div className="flex flex-col gap-1">
                <div className="eyebrow text-fog">Resources</div>
                <FootLink href="/docs">Docs</FootLink>
                <FootLink href="/proof">Proof</FootLink>
                <FootLink href="/status">Status</FootLink>
              </div>
              <div className="flex flex-col gap-1">
                <div className="eyebrow text-fog">Legal</div>
                <FootLink href="/privacy">Privacy</FootLink>
                <FootLink href="/terms">Terms</FootLink>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-t border-mist pt-6 md:flex-row md:items-end md:justify-between">
            <ul className="space-y-1.5">
              {HONESTY.map((h) => (
                <li key={h} className="text-[12px] leading-relaxed text-fog">{h}</li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Ovryth on GitHub"
                className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-smoke transition-colors hover:bg-snow hover:text-ink"
              >
                <GitHubMark />
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Ovryth on X"
                className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-smoke transition-colors hover:bg-snow hover:text-ink"
              >
                <XMark />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Logo";

const GITHUB_URL = "https://github.com/mystiquemide/ovryth";
const X_URL = "https://x.com/ovryth";

const HONESTY = [
  "Seeded accounts are labeled as seeded.",
  "Telegram does not expose account age, so it is approximated from the user id and first-seen date.",
  "Spend permissions need a Base Account (smart wallet); plain EOAs are unsupported.",
];

function FootLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "text-[14px] text-smoke transition-colors duration-150 hover:text-ink";
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
            Fund a weekly cap in your own Base Account, add the bot to your Telegram, and start paying members for real
            work within minutes.
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
                Payroll for real community work. Paid in USDC on Base, capped on chain.
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
              <div className="flex flex-col gap-3">
                <div className="eyebrow text-fog">Resources</div>
                <FootLink href="/docs">Docs</FootLink>
                <FootLink href="/proof">Proof</FootLink>
                <FootLink href="/status">Status</FootLink>
              </div>
              <div className="flex flex-col gap-3">
                <div className="eyebrow text-fog">More</div>
                <FootLink href={GITHUB_URL} external>GitHub</FootLink>
                <FootLink href={X_URL} external>X</FootLink>
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
            <div className="flex items-center gap-4 text-[12px] text-fog">
              <FootLink href="/privacy">Privacy</FootLink>
              <FootLink href="/terms">Terms</FootLink>
              <FootLink href="/status">Status</FootLink>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

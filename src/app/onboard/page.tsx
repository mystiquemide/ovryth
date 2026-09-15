import { Nav } from "@/components/site/Nav";
import { MinimalFooter } from "@/components/site/MinimalFooter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata = { title: "Onboard · Ovryth" };

const HOW = [
  ["A project funds a weekly cap", "The project puts a weekly USDC budget in its own Base Account and grants Ovryth a spend permission. The cap lives on chain and can be revoked in one signature."],
  ["Members do real work in Telegram", "People answer questions, translate docs, and write guides in the project's existing Telegram group, where Ovryth is an admin."],
  ["Ovryth pays for good work, refuses the rest", "Each message is scored against the project's rules. Real work is paid in USDC within minutes. Farming and copies are refused in public, with a reason."],
  ["The cap can never be crossed", "Payouts are one on-chain transaction from the project's account to the member. Ovryth never holds funds, and a payout past the cap reverts."],
];

const GLOSSARY = [
  ["Base Account", "A smart-wallet account on Base (from the Base app or Coinbase Wallet). It is what lets a project sign a spend permission. A plain seed-phrase wallet (EOA) cannot do this."],
  ["Spend permission", "A signed, on-chain rule that lets Ovryth spend up to a set amount per week, from the project's account, and nothing more. Revocable any time."],
  ["Non-custodial", "Ovryth never holds your money. The budget stays in the project's account until a single transaction pays a member."],
  ["Public refusals", "If a message is not real work, Ovryth says so in the group with a short reason, once per person per day."],
  ["Approximate account age", "Telegram does not expose when an account was created, so Ovryth estimates it from the user id and when they were first seen. It is labeled as approximate."],
];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-mist bg-paper text-[14px] text-ink">{n}</span>
      <div>
        <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-smoke">{body}</p>
      </div>
    </li>
  );
}

function PathCard({ title, need, steps, cta }: { title: string; need: string[]; steps: string[]; cta: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-mist bg-paper p-6">
      <h3 className="h3">{title}</h3>
      <div className="mt-4">
        <div className="eyebrow mb-2 text-fog">What you need</div>
        <ul className="space-y-1.5">
          {need.map((x) => (
            <li key={x} className="flex gap-2 text-[14px] text-ink"><span className="text-link">·</span>{x}</li>
          ))}
        </ul>
      </div>
      <div className="mt-5">
        <div className="eyebrow mb-2 text-fog">Steps</div>
        <ol className="space-y-1.5">
          {steps.map((x, i) => (
            <li key={x} className="flex gap-2 text-[14px] text-smoke"><span className="mono text-fog">{i + 1}</span>{x}</li>
          ))}
        </ol>
      </div>
      <div className="mt-6">{cta}</div>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="mx-auto max-w-[820px] px-6 py-16">
        <p className="eyebrow">Onboard</p>
        <h1 className="h1 mt-3 max-w-[620px]">New to Ovryth? Start here</h1>
        <p className="body-lg mt-4 max-w-[640px] text-smoke">
          Ovryth pays people for real work in a project&apos;s Telegram, in USDC on Base. This page explains what that
          means and what you need before you open or join a room. No prior crypto experience assumed.
        </p>

        <section className="mt-14 border-t border-mist pt-12">
          <h2 className="h2">How it works</h2>
          <ol className="mt-6 space-y-6">
            {HOW.map(([title, body], i) => <Step key={title} n={i + 1} title={title} body={body} />)}
          </ol>
        </section>

        <section className="mt-14 border-t border-mist pt-12">
          <h2 className="h2">Which one are you?</h2>
          <p className="mt-3 max-w-[560px] text-[15px] text-smoke">Two ways to use Ovryth. Pick the one that fits and follow the short list.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <PathCard
              title="Earn in a room"
              need={["A Base wallet address to receive USDC", "A Telegram account"]}
              steps={["Join a project's group where Ovryth is active", "DM @Ovryth_bot: /wallet 0xYourAddress", "Answer a pinned question with real, specific work", "Get paid in-thread with a BaseScan link"]}
              cta={<ButtonLink href="/room" variant="secondary">See a live room →</ButtonLink>}
            />
            <PathCard
              title="Open a room"
              need={["A Base Account (smart wallet, not a seed-phrase wallet)", "Some USDC on Base for the weekly cap", "A Telegram group where you are an admin"]}
              steps={["Connect your Base Account", "Set the weekly cap and sign the spend permission", "Write your rules for what counts as work", "Add @Ovryth_bot to your group and send /link"]}
              cta={<ButtonLink href="/open" variant="primary">Open a room</ButtonLink>}
            />
          </div>
        </section>

        <section className="mt-14 border-t border-mist pt-12">
          <h2 className="h2">Good to know</h2>
          <dl className="mt-6 divide-y divide-mist">
            {GLOSSARY.map(([term, def]) => (
              <div key={term} className="grid grid-cols-1 gap-1 py-4 md:grid-cols-[200px_1fr] md:gap-6">
                <dt className="text-[15px] font-semibold text-ink">{term}</dt>
                <dd className="text-[15px] leading-relaxed text-smoke">{def}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14 border-t border-mist pt-10">
          <p className="text-[15px] text-smoke">
            Ready? <a href="/open" className="text-link hover:underline">Open a room</a> or{" "}
            <a href="/room" className="text-link hover:underline">look at a live room</a> first.
          </p>
        </section>
      </main>
      <MinimalFooter />
    </>
  );
}

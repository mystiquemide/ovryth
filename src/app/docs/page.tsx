import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

export const metadata = { title: "Docs · Ovryth" };

const TOC = [
  ["overview", "Overview"],
  ["how-it-works", "How it works"],
  ["getting-started", "Getting started"],
  ["core-concepts", "Core concepts"],
  ["room-flow", "Room flow"],
  ["telegram", "Telegram commands"],
  ["console", "Console"],
  ["api", "API reference"],
  ["technical", "Technical details"],
] as const;

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="h2 scroll-mt-24">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed text-smoke">{children}</p>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-[17px] font-semibold text-ink">{children}</h3>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="mono rounded bg-snow px-1.5 py-0.5 text-[13px] text-ink">{children}</code>;
}

const ENDPOINTS: [string, string, string, string][] = [
  ["POST", "/api/rooms", "Owner signature", "Create a room from a signed spend permission and initial rules. Returns { slug, linkCode }."],
  ["GET", "/api/rooms/[slug]", "Public", "Public room JSON: room, permission status, rules version, this week's payouts and refusals, totals."],
  ["PUT", "/api/rooms/[slug]/rules", "Owner signature", "Publish a new rules version. Returns { version }."],
  ["POST", "/api/rooms/[slug]/pause", "Owner signature", "Pause or resume scoring. Body { paused: boolean }."],
  ["POST", "/api/telegram", "Secret header", "Telegram webhook. Always 200 after storing; work runs after the response."],
  ["POST", "/api/tick", "Bearer TICK_SECRET", "Sweeper: retry payouts, release holds, poll permission status, alert on low gas."],
];

const CONCEPTS: [string, string][] = [
  ["Base Account", "A smart-wallet account on Base that can sign a spend permission. Plain seed-phrase wallets (EOAs) are not supported."],
  ["Spend permission", "A signed, on-chain authorization letting the Ovryth payer spend up to a weekly allowance from the project's account, and no more. Revocable in one transaction."],
  ["Weekly cap", "The allowance per 7-day period. A payout past it reverts on chain. It resets each period."],
  ["Non-custodial", "Ovryth never holds funds. Each payout is one transaction from the project's account to the member."],
  ["Refusal", "A message judged not to be real work. Ovryth replies in public with a fixed reason, at most once per member per day."],
  ["Hold", "Approved work with no linked wallet is held for 72 hours, then released back to the budget."],
  ["Floors", "Minimum account age and room tenure, plus per-member weekly and per-room daily caps, applied before payment."],
];

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-[1064px] px-6 py-16">
        <p className="eyebrow">Documentation</p>
        <h1 className="h1 mt-3">Ovryth docs</h1>
        <p className="body-lg mt-4 max-w-[640px] text-smoke">Everything needed to understand, use, and build on Ovryth: payroll for real community work, paid in USDC on Base.</p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[200px_1fr] lg:gap-16">
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-2">
              {TOC.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="block text-[14px] text-smoke transition-colors hover:text-ink">{label}</a>
              ))}
            </div>
          </nav>

          <div className="max-w-[680px]">
            <section>
              <H id="overview">Overview</H>
              <P>Ovryth pays members who do real work in a project&apos;s Telegram, in USDC on Base, within minutes. The project keeps its budget in its own Base Account and grants Ovryth a capped, revocable spend permission. Low-quality or copied messages are refused in public with a reason, and Ovryth can never spend past the weekly cap because the cap is enforced on chain.</P>
            </section>

            <section className="mt-12">
              <H id="how-it-works">How it works</H>
              <P>A project funds a weekly cap in its Base Account and grants a spend permission naming the Ovryth payer contract as the only spender. Members post work in the project&apos;s Telegram group where Ovryth is an admin. Each message is scored against the project&apos;s rules; real work is paid, and everything else is refused in public. Every payout is a single on-chain transaction, and a payout past the cap reverts.</P>
            </section>

            <section className="mt-12">
              <H id="getting-started">Getting started</H>
              <Sub>Earn in a room</Sub>
              <P>Join a project&apos;s group where Ovryth is active, DM the bot <Code>/wallet 0xYourAddress</Code> once, then answer a pinned question with real, specific work. You are paid in-thread with a BaseScan link. Copying an earlier answer is refused.</P>
              <Sub>Open a room</Sub>
              <P>You need a Base Account, some USDC on Base for the weekly cap, and a Telegram group where you are an admin. Connect at <Code>/open</Code>, set the allowance and sign the spend permission, write your rules, then add <Code>@Ovryth_bot</Code> and send <Code>/link</Code> in the group.</P>
            </section>

            <section className="mt-12">
              <H id="core-concepts">Core concepts</H>
              <dl className="mt-4 divide-y divide-mist">
                {CONCEPTS.map(([t, d]) => (
                  <div key={t} className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6">
                    <dt className="text-[14px] font-semibold text-ink">{t}</dt>
                    <dd className="text-[14px] leading-relaxed text-smoke">{d}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-12">
              <H id="room-flow">Room flow</H>
              <P>For each message: a cheap pre-filter checks length, links, duplicates, and floors. Candidates that pass go to the model, which classifies the message against the room&apos;s categories and proposes an amount within the category range. A deterministic policy layer then applies floors and caps and can only lower or zero the amount, never raise it. The result is a payout to the member&apos;s linked wallet, a 72-hour hold if there is no wallet, or a public refusal. Recipients come only from the wallet a member linked in a DM, never from message text.</P>
            </section>

            <section className="mt-12">
              <H id="telegram">Telegram commands</H>
              <dl className="mt-4 divide-y divide-mist">
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6"><dt><Code>/wallet 0x…</Code></dt><dd className="text-[14px] text-smoke">DM the bot to link your payout address. Changing it requires a confirmation.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6"><dt><Code>/rules</Code></dt><dd className="text-[14px] text-smoke">DM the bot to list the rooms you are in and their rules.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6"><dt><Code>/link &lt;code&gt;</Code></dt><dd className="text-[14px] text-smoke">Sent in a group by the owner to bind it to a room.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[180px_1fr] md:gap-6"><dt><Code>#question …</Code></dt><dd className="text-[14px] text-smoke">Pin a question so answers are judged against a real prompt.</dd></div>
              </dl>
            </section>

            <section className="mt-12">
              <H id="console">Console</H>
              <P>The owner console at <Code>/console</Code> shows the weekly budget bar, the spend permission, the ledger of paid and refused contributions, and operator notes (last sweeper run, pending jobs, operator gas). Owners connect their Base Account to pause or resume the room and edit the rules; both actions are signed and verified against the room owner. Revoking is done from the Base Account&apos;s own permissions screen and stops Ovryth immediately.</P>
            </section>

            <section className="mt-12">
              <H id="api">API reference</H>
              <div className="mt-4 overflow-hidden rounded-card border border-mist">
                {ENDPOINTS.map(([m, path, auth, desc], i) => (
                  <div key={path} className={`grid grid-cols-1 gap-1 p-4 md:grid-cols-[auto_1fr] md:gap-4 ${i > 0 ? "border-t border-mist" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="mono rounded bg-snow px-1.5 py-0.5 text-[12px] font-medium text-ink">{m}</span>
                      <span className="mono text-[13px] text-ink">{path}</span>
                    </div>
                    <div>
                      <div className="text-[14px] text-smoke">{desc}</div>
                      <div className="mono mt-1 text-[12px] text-fog">auth: {auth}</div>
                    </div>
                  </div>
                ))}
              </div>
              <P>Owner-signed routes take a SIWE-style message signed by the room&apos;s Base Account, valid for ten minutes. The public room JSON is also rendered on the room page.</P>
            </section>

            <section className="mt-12">
              <H id="technical">Technical details</H>
              <P>Chain: Base mainnet, chain id 8453. USDC <Code>0x8335…2913</Code>. Coinbase SpendPermissionManager <Code>0xf852…67Ad</Code>. OvrythPayer <Code>0x4854…3999</Code>, verified on BaseScan, with no withdraw, no arbitrary call, and no way to hold funds. The payer&apos;s <Code>pay()</Code> approves the permission once, spends within the cap, and transfers to the member in a single transaction. Stack: Next.js App Router, viem, Prisma on Neon Postgres, and a raw Telegram Bot API webhook. See <a href="/proof" className="text-electric hover:underline">/proof</a> for the on-chain artifacts.</P>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

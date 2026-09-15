import { Nav } from "@/components/site/Nav";
import { MinimalFooter } from "@/components/site/MinimalFooter";
import { DocsToc } from "@/components/site/DocsToc";

export const metadata = { title: "Docs · Ovryth", alternates: { canonical: "/docs" } };

const TOC = [
  ["overview", "Overview"],
  ["how-it-works", "How it works"],
  ["getting-started", "Getting started"],
  ["core-concepts", "Core concepts"],
  ["room-flow", "Room flow"],
  ["telegram", "Telegram commands"],
  ["console", "Console"],
  ["safety", "Safety model"],
  ["api", "API reference"],
  ["technical", "Technical details"],
  ["limitations", "Current limitations"],
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
  ["GET", "/api/rooms/[slug]", "Public", "Public room JSON: room, live permission state when available, rules, weekly payouts/refusals, and totals."],
  ["PUT", "/api/rooms/[slug]/rules", "Owner signature", "Publish a new immutable rules version."],
  ["POST", "/api/rooms/[slug]/pause", "Owner signature", "Pause or resume scoring."],
  ["POST", "/api/rooms/[slug]/revoke", "Chain-authoritative", "Confirm an onchain revoke and record the real revoke transaction."],
  ["POST", "/api/telegram", "Telegram secret header", "Webhook intake. Returns quickly, then processes with Next.js after()."],
  ["POST", "/api/paymaster", "Rate-limited + allowlisted", "Proxy selected CDP Paymaster/Bundler JSON-RPC methods without exposing the upstream key."],
  ["POST", "/api/tick", "Bearer TICK_SECRET", "Retry payouts, release holds, poll permission state, and check operator gas."],
  ["GET", "/api/tick", "Bearer CRON_SECRET", "Cron-triggered sweeper."],
  ["GET", "/api/proof", "Public", "Machine-readable proof artifacts for evaluators and agents."],
];

const CONCEPTS: [string, string][] = [
  ["The agent", "Ovryth runs inside a linked Telegram group. It filters obvious farming, classifies substantive work, applies deterministic payout policy, and can execute a USDC payment without a human signing each payout."],
  ["Base Account", "The project owner smart account that holds the budget and authorizes the spend permission. Plain EOAs are not supported as room-owner budget accounts in the current implementation."],
  ["Spend permission", "A revocable Base authorization naming OvrythPayer as spender and limiting how much USDC can be spent per period."],
  ["Deterministic policy", "The model proposes a category and amount. Code then enforces confidence, owner-defined category ranges, member and room caps, remaining onchain allowance, and wallet state."],
  ["Non-custodial payout", "Normal payout flow pulls the exact amount under the spend permission and forwards it to the linked contributor in the same transaction."],
  ["Refusal", "A contribution that fails the prefilter, classifier, or deterministic policy. Public refusal replies are rate-limited while the refusal record stays stored."],
  ["Hold", "Approved work with no linked payout wallet is held for 72 hours instead of paying an arbitrary address."],
  ["Approximate account age", "Telegram does not expose exact account creation time. Ovryth uses an explicitly approximate signal from the numeric user id and tracks room tenure separately."],
];

export default function DocsPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="mx-auto max-w-[1064px] px-6 py-16">
        <p className="eyebrow">Documentation</p>
        <h1 className="h1 mt-3">Ovryth docs</h1>
        <p className="body-lg mt-4 max-w-[680px] text-smoke">
          Product and technical documentation for Ovryth, an autonomous contribution-rewards agent that pays useful Telegram work in USDC on Base under a revocable onchain spending boundary.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {[
            ["Earn in a room", "#getting-started"],
            ["Create a room", "#getting-started"],
            ["Inspect proof", "/proof"],
            ["Use the API", "#api"],
          ].map(([label, href]) => (
            <a key={label} href={href} className="inline-flex min-h-[36px] items-center rounded-pill border border-mist bg-paper px-4 text-[13px] text-ink transition-colors hover:bg-snow">
              {label}
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[200px_1fr] lg:gap-16">
          <DocsToc items={TOC} />

          <div className="max-w-[700px]">
            <section>
              <H id="overview">Overview</H>
              <P>
                Ovryth watches a linked Telegram group for useful community work, filters obvious farming, classifies qualifying messages against the room&apos;s rules, applies deterministic payout policy, and pays contributors in USDC on Base when all checks pass. The project keeps its budget in its own Base Account. Ovryth receives a bounded spend permission rather than unrestricted treasury custody.
              </P>
            </section>

            <section className="mt-12">
              <H id="how-it-works">How it works</H>
              <P>
                The agent loop is: Telegram intake → deterministic prefilter → Groq classifier with Gemini fallback → deterministic policy → pay, hold, or refuse. Recipient selection happens outside the model and comes only from the wallet the Telegram user linked by DM. Before every real payout, Ovryth reads live permission state, fails closed if that state cannot be verified, simulates the transaction, and then submits <Code>OvrythPayer.pay()</Code> from the operator account.
              </P>
            </section>

            <section className="mt-12">
              <H id="getting-started">Getting started</H>

              <Sub>Earn in a room</Sub>
              <P>
                Join a Telegram group where Ovryth is active. DM <Code>@Ovryth_bot</Code> with <Code>/wallet 0xYourAddress</Code>, then contribute substantive work in the group. A successful payout is replied to in-thread with the USDC amount, category, reason, and BaseScan link.
              </P>

              <Sub>Open a room</Sub>
              <P>
                Start at <Code>/open</Code>. You need a Base Account, USDC on Base, and a Telegram group where you are an admin. Connect your Base Account, choose a weekly allowance, complete Coinbase&apos;s hosted spend-permission consent, define your room rules, create the room, add <Code>@Ovryth_bot</Code> as a group admin, and send the one-time <Code>/link &lt;code&gt;</Code> command.
              </P>
              <P>
                The current hosted permission consent is not documented as gasless. The owner account pays the permission-manager gas in this flow. The payout operator pays gas for normal automated payouts.
              </P>
            </section>

            <section className="mt-12">
              <H id="core-concepts">Core concepts</H>
              <dl className="mt-4 divide-y divide-mist">
                {CONCEPTS.map(([t, d]) => (
                  <div key={t} className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6">
                    <dt className="text-[14px] font-semibold text-ink">{t}</dt>
                    <dd className="text-[14px] leading-relaxed text-smoke">{d}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="mt-12">
              <H id="room-flow">Room flow</H>
              <P>
                The prefilter rejects messages under 24 characters or 3 words, link-only content, exact or near duplicates, members below configured floors, exhausted member/room caps, and rooms with no remaining spend allowance. Near-duplicate detection uses a 64-bit SimHash with Hamming distance up to 3, alongside an exact normalized SHA-256 content hash.
              </P>
              <P>
                Messages that pass go to the structured classifier. Wallet addresses and explicit token or dollar amounts are masked before the model sees the text. The model can return only a category, proposed amount, reason, and confidence. It cannot return a recipient or arbitrary contract action.
              </P>
              <P>
                Deterministic policy then checks confidence, the current rules version, account-age and tenure floors, member weekly budget, room daily budget, remaining onchain allowance, and wallet presence. Proposals above a category maximum are clamped down. Proposals below the owner-defined category minimum are normalized up to that minimum, then can still be reduced by tighter member, room, or onchain ceilings. If there is not enough headroom to pay at least the category minimum, the contribution is refused.
              </P>
            </section>

            <section className="mt-12">
              <H id="telegram">Telegram commands</H>
              <dl className="mt-4 divide-y divide-mist">
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>/wallet 0x…</Code></dt><dd className="text-[14px] text-smoke">DM the bot to link your payout address.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>/wallet 0x… confirm</Code></dt><dd className="text-[14px] text-smoke">Explicitly replace an already-linked wallet.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>/rules</Code></dt><dd className="text-[14px] text-smoke">In a group, show that room&apos;s current rules. In DM, list your active rooms and public rule pages.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>/start /help /commands</Code></dt><dd className="text-[14px] text-smoke">Explain how to link a wallet and earn in the current room.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>/link &lt;code&gt;</Code></dt><dd className="text-[14px] text-smoke">Admin-only group binding. Ovryth also checks that the bot itself is an admin.</dd></div>
                <div className="grid grid-cols-1 gap-1 py-3.5 md:grid-cols-[190px_1fr] md:gap-6"><dt><Code>#question …</Code></dt><dd className="text-[14px] text-smoke">Admin-only classifier context for an open community question.</dd></div>
              </dl>
            </section>

            <section className="mt-12">
              <H id="console">Console</H>
              <P>
                The canonical showcase console is <Code>/console</Code>. Other rooms use <Code>/console/[slug]</Code>. The console exposes the budget, permission, current rules, payout/refusal ledger, sweeper state, and operator gas. Viewing a console is not treated as the authorization boundary. Mutating owner actions are authenticated.
              </P>
              <P>
                Pause/resume and rules updates require a fresh canonical Base Account signature with a 10-minute TTL. Revocation is requested by the connected room-owner Base Account through the spend-permission SDK, then the backend confirms the revoke from chain state before marking the room revoked. The current revoke flow is account-paid.
              </P>
            </section>

            <section className="mt-12">
              <H id="safety">Safety model</H>
              <P>
                Ovryth treats Telegram messages and model output as untrusted. Message addresses and explicit amounts are masked before classification. The model never chooses the payout recipient. Recipient resolution happens from the contributor&apos;s stored DM-linked wallet after policy. Coinbase SpendPermissionManager remains the final spending boundary on Base, so an application-level mistake cannot raise the onchain allowance.
              </P>
              <P>
                Money-moving code fails closed. If permission status cannot be read, the payout is not sent. A queued payout can be retried by the sweeper later. Transaction calls are simulated by default before broadcast.
              </P>
            </section>

            <section className="mt-12">
              <H id="api">API reference</H>
              <div className="mt-4 overflow-hidden rounded-card border border-mist">
                {ENDPOINTS.map(([m, path, auth, desc], i) => (
                  <div key={`${m}-${path}`} className={`grid grid-cols-1 gap-1 p-4 md:grid-cols-[auto_1fr] md:gap-4 ${i > 0 ? "border-t border-mist" : ""}`}>
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
              <P>
                Current app-level limits are 5 room creations/hour/IP, 60 paymaster requests/minute/IP, and 60 Telegram contributions/minute/chat. These counters use an in-memory limiter in the present demo deployment.
              </P>
            </section>

            <section className="mt-12">
              <H id="technical">Technical details</H>
              <P>
                Chain: Base mainnet, chain id 8453. USDC <Code>0x8335…2913</Code>. Coinbase SpendPermissionManager <Code>0xf852…67Ad</Code>. Verified OvrythPayer <Code>0x4854…3999</Code>. The payer has no general withdraw, arbitrary-call, ETH receive, or rescue path. Normal payouts pull and forward the exact token amount in one transaction. The only other state-changing function is operator rotation.
              </P>
              <P>
                Classifier order is Groq <Code>openai/gpt-oss-120b</Code> first, Gemini <Code>gemini-2.5-flash</Code> second. The repository currently verifies 51 Vitest tests and 7 Base-fork Foundry tests, for 58 automated tests total. See <a href="/proof" className="text-link hover:underline">/proof</a> for onchain evidence and the repository&apos;s <Code>docs/ARCHITECTURE.md</Code> for implementation-level detail.
              </P>
            </section>

            <section className="mt-12">
              <H id="limitations">Current limitations</H>
              <P>
                Telegram account age is approximate. Deleted Telegram messages cannot be observed after deletion. Edits are flagged but confirmed transfers are not clawed back. The current generic rate limiter is in-memory and should be replaced with a durable distributed store for horizontal production scale. If both LLM providers fail, Ovryth stores the message but does not invent a payout or content-based refusal; automatic classifier retry is not implemented in the current webhook path.
              </P>
            </section>
          </div>
        </div>
      </main>
      <MinimalFooter />
    </>
  );
}

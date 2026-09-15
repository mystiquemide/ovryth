# Ovryth

An AI agent that runs payroll for token communities on Base. Ovryth lives inside a project's Telegram group: it reads every contribution, decides what counts as real work under the project's own rules, and pays members in USDC within minutes — refusing copied and low-effort posts in public, with a reason. The budget never leaves the project's own Base Account, and the on-chain spend permission caps every move the agent can make.

Built for the Orion Builder Hackathon (AI agents).

**Live:** [ovryth.midelabs.xyz](https://ovryth.midelabs.xyz) · **Room:** [ovryth.midelabs.xyz/room](https://ovryth.midelabs.xyz/room) · **Demo group:** [t.me/ovryth_demo_room](https://t.me/ovryth_demo_room) · **Proof:** [ovryth.midelabs.xyz/proof](https://ovryth.midelabs.xyz/proof) · **Bot:** [@Ovryth_bot](https://t.me/Ovryth_bot) · **X:** [@ovryth](https://x.com/ovryth)

![The weekly budget bar](https://ovryth.midelabs.xyz/og.png)

## The problem

Token communities run on volunteer work: support answers, translations, guides, moderation. Paying for it today means a community manager hand-sending tips off a spreadsheet, or a quest platform that holds the budget on its own rails. The first is unpaid labor for the manager, the second means trusting a platform with the project's treasury, and both get farmed by copy-paste spam the moment money shows up.

Ovryth is the alternative: an AI agent inside the group that decides what counts as real work and pays it, while the budget stays in the project's own Base Account under an on-chain cap the agent cannot cross.

## Try it in two minutes

1. Join the demo group: [t.me/ovryth_demo_room](https://t.me/ovryth_demo_room). The agent is an admin there.
2. DM [@Ovryth_bot](https://t.me/Ovryth_bot): `/wallet 0xYourBaseAddress` — this is where USDC lands.
3. Answer one pinned question in the group with real, specific work.
4. The agent replies `Paid X USDC …` with a BaseScan link within minutes.
5. Post a copy of someone's paid answer from a second account. The agent refuses it in public with the reason.

## The agent

Per message, Ovryth loops: read → a cheap pre-filter (length, links, duplicates, account-age and tenure floors) → a model classifies the message against the room's rules and proposes an amount inside the category range → a deterministic policy layer applies the caps and can only lower or zero the amount, never raise it → the agent acts. Pay in one transaction, hold for 72 hours when no wallet is linked, or refuse in public with a fixed reason. Recipients come only from a wallet the member linked by DM, never from message text.

The spend permission is the leash. The agent can never move more than the weekly cap, and the project cuts the leash with one signature, from the owner console or its own Base Account — see [`0x13994304…d2c96`](https://basescan.org/tx/0x139943041ac91448f6de842ec9151af6e71fa577a564fc82b202bd81ac6d2c96).

## What happens on chain

```
Project Base Account  →  SpendPermissionManager  →  OvrythPayer  →  Member wallet
   (holds the budget)     (enforces weekly cap)      (verified)      (linked by DM)
```

A payout is one transaction from the project's account to the member. The first payout registers the signed permission (`approveWithSignature`), spends within the weekly cap, then transfers to the member — see [`0x9d44d136…392270`](https://basescan.org/tx/0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270). The payer contract has no withdraw function and no arbitrary call; it can only run `pay()` against a permission that names it as spender.

## Why Base

Every piece of the money path is a named, load-bearing integration:

- **Base Account (Coinbase Smart Wallet)** holds the project budget. Funds stay in the project's own account; nothing ever rests in an Ovryth wallet or contract. The account is also the owner identity for the console — pause and rules changes are signature-verified ERC-1271 messages from it.
- **Spend Permissions + SpendPermissionManager** are the agent's leash. The project signs a weekly USDC allowance naming the payer contract as the only spender. The cap, the period, and revocation are enforced by Coinbase's manager contract on chain, not by Ovryth's code.
- **OvrythPayer** is a minimal verified contract that can only run `pay()`: register the permission if needed, spend within the cap, forward the exact amount to the member. One transaction, nothing in between.
- **CDP Paymaster** sponsors the owner's smart-account calls (including the one-signature revoke) through `/api/paymaster`, a server-side proxy that allowlists JSON-RPC methods so the CDP client key never reaches the browser. Payout gas is operator-funded, so the project never needs ETH.
- **Telegram Bot API** is the agent's surface: it reads contributions in the group, replies with verdicts in-thread, and links member wallets by DM.
- **Gemini / Groq** classify each message behind one zod schema; a deterministic policy layer clamps the model's proposal and can only lower it, never raise it.

## Proof

| Claim | Evidence |
|---|---|
| Spend permission approved on chain | Inside the first payout tx — [`0x9d44d136`](https://basescan.org/tx/0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270) |
| Capped payout to a linked member wallet | [`0xdd81d096`](https://basescan.org/tx/0xdd81d096bfc7edcccda3a327549e8f14953c0c816b1021f90bf2cbd3fa34635a) |
| Over-cap payout reverts | [`0x2a0e8147`](https://basescan.org/tx/0x2a0e8147e07e9685d8a03443e86a7f605074d889a9d58361e7cb293d2429436b) |
| Revoke in one signature | [`0x13994304`](https://basescan.org/tx/0x139943041ac91448f6de842ec9151af6e71fa577a564fc82b202bd81ac6d2c96) |
| Payer contract, verified source | [`0x4854…3999`](https://basescan.org/address/0x485457f86fbf5e2385ae183bd5518c7d965e3999#code) |
| CI | tsc, eslint, vitest, build, forge tests on every push |

## What it is not

No leaderboard, no XP, no quests, no treasury wallet, no moderation tooling, no content posting. Ovryth does one job: pay the right member the right amount for real work, and never touch more than the project authorized.

| | Ovryth | Valor (checked 2026-09-14) | Zealy AI review (checked 2026-09-14) |
|---|---|---|---|
| What runs it | An agent, end to end: reads, decides, pays, refuses | Reviewer tooling | Quest review flow |
| Budget custody | Project's own Base Account | Treasury wallet | Platform-held |
| Cap enforcement | On chain, in the permission | App-side | App-side |
| Public refusals with reasons | Yes | No | No |
| Sybil floors (age, tenure, caps) | Yes | No | Paid plan |

## What is live vs not

Live on Base mainnet with real USDC: room creation, Telegram intake, scoring, payouts, public refusals, the budget bar, and the proof page. Demo-room participants are labeled as demo. Telegram does not expose account creation dates, so member account age is approximated from the user id and first-seen date. Plain EOAs cannot hold a project budget — a Base Account is required. External rooms (owners we do not control) are being onboarded during the hackathon judging window.

## Rules and refusals

Each room publishes its own rules: paid categories with USDC ranges, a per-member weekly cap, a room daily cap, and account-age/tenure floors. The model classifies a message against the rules and proposes an amount inside the category range; a deterministic policy layer can only lower that amount or zero it, never raise it. Refusals carry one of a fixed set of reasons — no substance, duplicate, too new, over cap — and appear publicly on the room page, at most one public refusal per member per day.

## Stack

Next.js 16, React 19, Tailwind v4, TypeScript strict · viem + `@base-org/account` spend permissions · Coinbase SpendPermissionManager + custom verified payer contract (Foundry) · Prisma on Postgres · raw Telegram Bot API · Groq/Gemini classification seam.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in: Neon DATABASE_URL/DIRECT_URL, bot token, keys
npx prisma migrate deploy
npm run dev                  # http://localhost:3000
```

```bash
npm run env:check            # prints SET/MISSING for every required variable
npm test                     # vitest, 45 tests
npm run build
cd contracts && forge test --fork-url https://mainnet.base.org   # needs foundry v1.0.0
```

## License

MIT

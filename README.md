# Ovryth

Payroll for real community work. A project keeps its weekly USDC budget in its own Base Account; Ovryth pays members who do real work in the project's Telegram within minutes, refuses copied and low-effort work in public with a reason, and can never spend past the cap because the cap is enforced on chain.

**Live:** [ovryth.midelabs.xyz](https://ovryth.midelabs.xyz) · **Room:** [ovryth.midelabs.xyz/room](https://ovryth.midelabs.xyz/room) · **Proof:** [ovryth.midelabs.xyz/proof](https://ovryth.midelabs.xyz/proof) · **Bot:** [@Ovryth_bot](https://t.me/Ovryth_bot)

![The weekly budget bar](https://ovryth.midelabs.xyz/og.png)

## Try it in two minutes

1. Open the [live room](https://ovryth.midelabs.xyz/room) and join its Telegram group.
2. DM [@Ovryth_bot](https://t.me/Ovryth_bot): `/wallet 0xYourBaseAddress` — this is where USDC lands.
3. Answer one pinned question in the group with real, specific work.
4. The bot replies `Paid X USDC …` with a BaseScan link within minutes.
5. Post a copy of someone's paid answer from a second account. It is refused in public with the reason.

## What happens on chain

```
Project Base Account  →  SpendPermissionManager  →  OvrythPayer  →  Member wallet
   (holds the budget)     (enforces weekly cap)      (verified)      (linked by DM)
```

A payout is one transaction from the project's account to the member. The first payout registers the signed permission (`approveWithSignature`), spends within the weekly cap, then transfers to the member — see [`0x9d44d136…392270`](https://basescan.org/tx/0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270). The payer contract has no withdraw function and no arbitrary call; it can only run `pay()` against a permission that names it as spender.

## Proof

| Claim | Evidence |
|---|---|
| Spend permission approved on chain | Inside the first payout tx — [`0x9d44d136`](https://basescan.org/tx/0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270) |
| Capped payout to a linked member wallet | [`0xdd81d096`](https://basescan.org/tx/0xdd81d096bfc7edcccda3a327549e8f14953c0c816b1021f90bf2cbd3fa34635a) |
| Over-cap payout reverts | [`0x2a0e8147`](https://basescan.org/tx/0x2a0e8147e07e9685d8a03443e86a7f605074d889a9d58361e7cb293d2429436b) |
| Revoke | One signature from the project's account; recorded on [/proof](https://ovryth.midelabs.xyz/proof) once executed |
| Payer contract, verified source | [`0x4854…3999`](https://basescan.org/address/0x485457f86fbf5e2385ae183bd5518c7d965e3999#code) |
| CI | tsc, eslint, vitest, build, forge tests on every push |

## What it is not

No leaderboard, no XP, no quests, no treasury wallet, no moderation tooling, no content posting. Ovryth does one job: pay the right member the right amount for real work, and never touch more than the project authorized.

| | Ovryth | Valor (checked 2026-09-14) | Zealy AI review (checked 2026-09-14) |
|---|---|---|---|
| Budget custody | Project's own Base Account | Treasury wallet | Platform-held |
| Cap enforcement | On chain, in the permission | App-side | App-side |
| Public refusals with reasons | Yes | No | No |
| Sybil floors (age, tenure, caps) | Yes | No | Paid plan |

## What is live vs not

Live on Base mainnet with real USDC: room creation, Telegram intake, scoring, payouts, public refusals, the budget bar, and the proof page. Demo-room participants are labeled as demo. Telegram does not expose account creation dates, so member account age is approximated from the user id and first-seen date. Plain EOAs cannot hold a project budget — a Base Account is required. External rooms (owners we do not control) are being onboarded during the hackathon judging window.

## Rules and refusals

Each room publishes its own rules: paid categories with USDC ranges, a per-member weekly cap, a room daily cap, and account-age/tenure floors. The model classifies a message against the rules and proposes an amount inside the category range; a deterministic policy layer can only lower that amount or zero it, never raise it. Refusals carry one of a fixed set of reasons — no substance, duplicate, too new, over cap — and appear publicly on the room page, at most one public refusal per member per day.

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

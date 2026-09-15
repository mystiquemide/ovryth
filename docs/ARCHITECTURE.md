# Ovryth Architecture

Version 1.3, 2026-09-15.

This file describes the implementation that is currently shipped in the repository. When this document and the code disagree, the code is authoritative.

## 1. System context

Actors:

- **Project owner**: Base Account holder and Telegram group admin.
- **Contributor**: Telegram member with an optional linked Base payout address.
- **Observer**: anyone reading the public room, proof, docs, or status pages.
- **Ovryth operator**: server-side key that submits payout transactions and holds gas ETH only.

External systems:

- **Telegram Bot API** for group intake, replies, admin checks, room binding, and contributor DMs.
- **Base mainnet**, chain ID `8453`.
- **Base USDC** at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- **Coinbase SpendPermissionManager** at `0xf85210B21cC50302F477BA56686d2019dC9b67Ad`.
- **OvrythPayer** at `0x485457f86fbf5e2385ae183bd5518c7d965e3999`.
- **Base Account SDK** in the owner's browser for connection, spend-permission consent, owner signatures, and revocation.
- **CDP Paymaster/Bundler** behind `/api/paymaster` for supported smart-account JSON-RPC operations. The current hosted spend-permission consent and revoke flows are account-paid and do not rely on app-supplied sponsorship for the permission-manager call.
- **Groq** as the default classifier provider, with **Gemini** as fallback.
- **Neon Postgres** through Prisma.
- **Base RPC** for permission status, simulation, receipts, balance reads, and proof.
- **BaseScan** for human-verifiable links.

## 2. High-level architecture

```text
Telegram group / DM
        |
        v
POST /api/telegram
        |
        v
Deterministic prefilter
        |
        v
Groq classifier -> Gemini fallback
        |
        v
Deterministic policy
    |         |         |
    |         |         +--> Refusal
    |         +------------> 72h hold
    +----------------------> Payout queue
                               |
                               v
                       Permission status read
                               |
                               v
                         simulate pay()
                               |
                               v
                    OvrythPayer on Base
                               |
                               v
                 SpendPermissionManager
                               |
                               v
                    Contributor wallet
```

The trust boundary is deliberate:

```text
model classifies -> deterministic policy decides -> chain permission enforces -> payer forwards
```

The model does not control the payout recipient, transaction target, permission, or treasury.

## 3. Containers and responsibilities

| Component | Tech | Responsibility |
|---|---|---|
| Web app | Next.js 16 App Router on Vercel | Landing, onboarding, consoles, public room, docs, proof, status, API routes |
| Telegram webhook | Next.js route + raw Bot API | Intake, commands, room binding, scoring trigger, replies |
| Decision engine | TypeScript in `src/lib/engine` | Prefilter, model classification, deterministic policy |
| Payout service | TypeScript + viem | Permission reads, simulation, transaction submission, receipt persistence |
| Payer contract | Solidity `^0.8.24` + Foundry | Restricted `pay()` path and operator rotation |
| Sweeper | `/api/tick` + `src/lib/sweeper/tick.ts` | Retry queued payouts, release expired holds, poll permission state, gas alert |
| Database | Neon Postgres + Prisma 7 | Rooms, rules, messages, candidates, decisions, payouts, refusals, holds, jobs |
| Proof layer | `/proof` + `/api/proof` | Human-readable and agent-readable evidence |
| Status layer | `/status` | Live checks for web/API, database, Base RPC, payer bytecode, Telegram bot |

## 4. Owner onboarding

Current owner flow:

```text
/open
  -> /onboard
  -> connect Base Account
  -> set weekly USDC allowance
  -> hosted spend-permission consent
  -> define room rules
  -> sign room authorization
  -> create room
  -> receive one-time Telegram link code
  -> add @Ovryth_bot as group admin
  -> /link <code>
  -> room active
```

Implementation details:

1. The browser creates a Base Account provider with `createBaseAccountSDK`.
2. The owner selects a weekly allowance.
3. `requestSpendPermission()` opens Coinbase's hosted consent flow with:
   - the owner's Base Account
   - `OvrythPayer` as spender
   - Base USDC as token
   - chain ID `8453`
   - a 7-day spend period
   - a 90-day permission end date
4. The current hosted consent path does not honor an app-supplied paymaster for the permission-manager approval. The owner account pays that gas.
5. The browser recomputes the permission hash and asks the owner to sign a canonical room-authorization message.
6. `POST /api/rooms` verifies both the permission structure and the owner signature before storing the room.
7. The room starts `pending_onchain` and receives a one-time link code.
8. `/link <code>` succeeds only when the sender is a group admin and the Ovryth bot is also an admin.
9. Successful linking stores the Telegram chat ID, clears the one-time code, and activates the room.

A Base Account is required in the current implementation. Plain EOAs are not supported as room-owner budget accounts.

## 5. Contribution pipeline

### 5.1 Telegram intake

Telegram calls `POST /api/telegram`.

The route:

- requires `X-Telegram-Bot-Api-Secret-Token`
- parses one Telegram update
- returns `200` quickly
- runs heavier work in Next.js `after()`

This prevents Telegram from waiting on LLM or chain operations.

Contribution messages are idempotent on `(roomId, telegramMessageId)`.

### 5.2 Member and wallet resolution

Ovryth upserts the Telegram user as a room member and synchronizes any DM-linked wallet into the room membership.

Contributor wallet commands:

```text
/wallet 0xYourAddress
/wallet 0xYourAddress confirm
```

The first links a payout address. Changing an existing address requires the explicit `confirm` suffix. Invalid addresses and the zero address are rejected.

The payout recipient is always resolved from stored wallet state. Message text and model output cannot select a recipient.

### 5.3 Deterministic prefilter

The current model-free prefilter runs before an LLM call.

Defaults:

| Check | Current behavior |
|---|---|
| Minimum message length | 24 characters |
| Minimum word count | 3 words |
| Link-only content | Refused |
| Exact duplicate | SHA-256 over normalized text |
| Near duplicate | 64-bit SimHash, Hamming distance `<= 3` |
| Duplicate history | Up to 500 recent room messages plus all messages with confirmed payouts |
| Account age | Approximate Telegram age signal, room-configured minimum |
| Tenure | First-seen room tenure, room-configured minimum |
| Member weekly cap | Checked before model |
| Room daily cap | Checked before model |
| Remaining onchain allowance | Checked before model |
| Public refusal reply limit | 1 per member per day |

The prefilter can only refuse. It cannot approve a payout.

Telegram does not expose exact account creation time. `approxAccountAgeDays` is estimated from the numeric Telegram user ID and is explicitly treated as approximate. Room tenure is tracked separately from first seen time.

### 5.4 Structured LLM classification

Messages that pass the prefilter go to `classify()`.

Default provider order:

1. Groq, model `openai/gpt-oss-120b`
2. Gemini, model `gemini-2.5-flash`

Both providers use the same Zod-defined structured response contract. Output must validate before policy sees it.

The model may return only:

```ts
{
  categoryKey: string | null;
  proposedAmountUsdc: number;
  reasonCode: ReasonCode;
  reasonText: string;
  confidence: number;
}
```

Before classification, Ovryth masks:

- `0x...` addresses as `[address]`
- explicit token amounts as `[amount]`
- dollar amounts as `[amount]`

The classifier receives the contribution text, the current room categories, owner free-text rules, and active admin-defined questions. It does not receive a payout recipient.

### 5.5 Deterministic policy

Policy is the application authority after classification.

Current order:

1. Reject null or unknown categories.
2. Enforce confidence floor `0.55`.
3. Re-check account-age and tenure floors.
4. Normalize the proposal into the owner-defined category range.
5. Check member weekly remaining budget.
6. Check room daily remaining budget.
7. Check remaining onchain allowance.
8. Reduce to the tightest remaining ceiling when necessary.
9. If the ceiling is below the category minimum, refuse on the binding cap.
10. If no wallet is linked, create a 72-hour hold instead of paying.
11. Otherwise approve the payout.

Important nuance: policy does not literally only lower the model proposal. A proposal below the owner-defined category minimum is normalized up to that minimum because the minimum is part of owner policy. A proposal above the category maximum is clamped down. The resulting amount can then be reduced by member, room, or onchain ceilings.

## 6. Payout execution

A positive decision creates one queued payout for that decision.

`processPayout()` then:

1. Loads the room permission and payout recipient from stored state.
2. Reads live permission status from Base.
3. Fails closed when permission status cannot be verified.
4. Refuses to send when the permission is revoked or inactive.
5. Determines whether `approveWithSignature` is still needed.
6. Encodes `OvrythPayer.pay(...)`.
7. Simulates the call by default.
8. Records simulation reverts without spending gas.
9. Sends the transaction from the operator account when simulation succeeds.
10. Waits for the Base receipt.
11. Stores confirmed or reverted state and transaction hash.
12. Increments the member paid total only after confirmation.

`simulateFirst: false` exists for the deliberate proof path that broadcasts an actual over-cap revert.

The application uses the operator key to submit calls to the payer contract. The operator is not the project budget owner and does not hold project USDC.

## 7. OvrythPayer contract

`contracts/src/OvrythPayer.sol` has two state-changing functions:

- `pay(...)`, callable only by the operator
- `setOperator(...)`, callable only by the current operator

Normal payout path:

```text
SpendPermissionManager.spend(permission, amount)
  -> USDC reaches OvrythPayer
  -> SafeERC20.safeTransfer(recipient, amount)
  -> recipient receives the same amount in the same transaction
```

The contract has:

- no general withdrawal function
- no arbitrary external-call function
- no ETH receive path
- no token rescue/sweep path

Normal payouts do not intentionally retain funds. The fork suite also proves the operator cannot extract stray tokens sent directly to the payer outside the normal flow.

## 8. Telegram behavior

### Group commands

| Command | Behavior |
|---|---|
| `/link <code>` | Admin-only room binding |
| `/rules` | Current categories, ranges, member cap, owner guidance, public room link |
| `/start`, `/help`, `/commands` | Explains earning flow and wallet linking |
| `#question ...` | Admin-only classifier context |

### DM commands

| Command | Behavior |
|---|---|
| `/wallet 0x...` | Link payout wallet |
| `/wallet 0x... confirm` | Replace existing payout wallet |
| `/rules` | List active rooms and their public rule pages |
| `/start` | Explain contributor flow |

### Edge cases

- Duplicate Telegram delivery is idempotent on room + message ID.
- Edited stored messages are re-hashed. If content changed, `editedAfterDecision` is set and the stored content hash is updated. Confirmed blockchain transfers are not clawed back.
- Deleted Telegram messages are not observable by the bot. The stored contribution remains the audit record.
- `migrate_to_chat_id` updates the room when a group becomes a supergroup.
- Removing or kicking the bot marks the room `inactive_bot`.
- Re-adding the bot can reactivate a room that was inactive only because the bot was removed.
- Non-command bot messages and unrelated slash commands are ignored.
- A per-chat 60/minute in-memory limit protects the model path from simple bursts.

## 9. Autonomous sweeper

The sweeper handles work that should not depend on one Telegram request succeeding.

Per tick it:

1. Retries queued payouts with fewer than five attempts, up to 20 rows.
2. Releases holds after 72 hours.
3. Polls permission status for non-terminal rooms.
4. Caches current permission status.
5. Marks rooms `revoked` or `expired` when chain state says so.
6. Sends one Telegram notice when a room becomes revoked.
7. Alerts the configured admin when operator gas falls below `0.002 ETH`.

`POST /api/tick` requires `Bearer TICK_SECRET`.

`GET /api/tick` supports the configured cron path with `CRON_SECRET`.

Permission read errors skip that room for the current tick and are retried later.

## 10. Public verification surfaces

| Surface | Purpose |
|---|---|
| `/room` | Showcase public room |
| `/r/[slug]` | Public room ledger, budget, rules, permission state |
| `/console` | Canonical showcase owner console |
| `/console/[slug]` | Room-specific owner console |
| `/proof` | Human-readable evidence |
| `/api/proof` | Machine-readable evidence |
| `/docs` | Product and API documentation |
| `/status` | Live system health |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

The public room reads real database state. Permission reads fail closed rather than showing a guessed healthy state.

The status page performs live checks for:

- web/API execution
- Neon Postgres
- Base mainnet RPC
- deployed payer bytecode
- Telegram bot `getMe`

## 11. Owner console and authentication

Viewing a console is not itself treated as an authorization boundary. Mutating owner operations are authenticated.

Pause/resume and rules updates require a fresh canonical Base Account signature containing:

```text
Ovryth room authorization
action: <action>
resource: <slug or permission hash>
issuedAt: <ISO timestamp>
```

The server verifies the signature against the owner Base Account with viem smart-account verification. Signatures expire after 10 minutes and future-dated messages beyond the tolerated clock skew are rejected.

Revocation is requested from the connected room-owner Base Account with the Base spend-permission SDK. The account pays gas for the current revoke flow. The backend then confirms chain state before marking the room revoked and discovers or validates the real onchain revoke transaction.

## 12. Data model

`prisma/schema.prisma` is authoritative.

Core models:

| Model | Purpose |
|---|---|
| `Room` | Community, owner, Telegram binding, lifecycle state |
| `Permission` | Signed permission, hash, allowance, period, cached status |
| `RulesVersion` | Immutable versioned room policy |
| `Question` | Admin-defined active classifier context |
| `Member` | Telegram user, first-seen tenure, approximate age, paid total |
| `LinkedWallet` | Telegram-user wallet linked by DM |
| `Wallet` | Room membership payout address |
| `Message` | Contribution text, hash, SimHash, edit flag |
| `Candidate` | Model or prefilter output, provider, latency |
| `Decision` | Final amount, reason, policy notes |
| `Payout` | Amount, recipient, attempts, state, tx hash, block, confirmation |
| `Refusal` | Rejected decision and public-reply flag |
| `Hold` | Approved contribution awaiting wallet, expiry/release |
| `Job` | Background operational state |

Room lifecycle:

```text
pending_onchain | active | paused | revoked | expired | inactive_bot
```

Payout lifecycle schema:

```text
queued | sent | confirmed | reverted | failed
```

## 13. Onchain vs offchain trust boundary

| Chain-enforced | Application state |
|---|---|
| Token | Contribution text |
| Authorized spender | LLM verdict |
| Allowance | Confidence |
| Spend period | Room rules metadata |
| Revocation | Refusals |
| Contract execution | Holds |
| Confirmed/reverted payout | Duplicate signals |

The core guarantee is that offchain classification alone cannot transfer funds. A payout still has to survive deterministic policy, live permission checks, contract execution, and SpendPermissionManager enforcement.

## 14. API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/telegram` | Telegram secret header | Webhook intake |
| `POST` | `/api/rooms` | Owner signature | Create room from permission + initial rules |
| `GET` | `/api/rooms/[slug]` | Public | Room, permission state, rules, weekly ledger, totals |
| `PUT` | `/api/rooms/[slug]/rules` | Owner signature | Publish next rules version |
| `POST` | `/api/rooms/[slug]/pause` | Owner signature | Pause/resume scoring |
| `POST` | `/api/rooms/[slug]/revoke` | Public confirmation endpoint backed by chain state | Confirm and record revocation |
| `POST` | `/api/paymaster` | App-level rate limit + method allowlist | Proxy selected CDP JSON-RPC methods |
| `POST` | `/api/tick` | `TICK_SECRET` bearer | Run sweeper |
| `GET` | `/api/tick` | `CRON_SECRET` bearer | Cron-triggered sweeper |
| `GET` | `/api/proof` | Public | Machine-readable proof |

Current app-level limits:

- room creation: 5/hour/IP
- paymaster proxy: 60/minute/IP
- Telegram contributions: 60/minute/chat

These limits use the current in-memory limiter. They are adequate for the single-instance demo shape but are not a durable distributed abuse-control layer. A horizontally scaled production deployment should move these counters to a durable store.

## 15. Paymaster proxy

`POST /api/paymaster` keeps the configured CDP endpoint server-side.

The proxy:

- accepts JSON only
- rejects JSON-RPC batches
- validates JSON-RPC envelopes
- caps request bodies at 128 KiB
- allows only the smart-account/paymaster methods the app needs
- applies an app-level 60/minute/IP limit
- returns `Cache-Control: no-store`

CDP Portal sponsorship rules remain external deployment configuration and must be configured separately from repository controls.

The current hosted spend-permission approval and revoke flows are not documented as gasless. The UI states that the owner account pays gas for those permission-manager transactions.

## 16. Failure behavior

| Failure | Current behavior |
|---|---|
| Too-short / link-only / duplicate message | Refused before model |
| Member below floors | Refused |
| Member or room cap exhausted | Refused |
| Remaining permission allowance unavailable or zero | Prefilter/policy refuses; chain read errors fail closed |
| Low model confidence | Refused |
| Model proposes outside range | Normalized/clamped to owner policy |
| Approved work has no wallet | 72-hour hold |
| Permission status read fails during payout | Payout remains queued with last error; no transaction is sent |
| Permission revoked/inactive | Payout is not sent |
| Simulation reverts | Reverted result recorded without spending gas |
| Broadcast transaction reverts | Reverted state and tx hash recorded |
| Telegram retries same message | Idempotent no-op |
| Bot removed | Room becomes `inactive_bot` |
| External revoke | Sweeper detects it and marks room `revoked` |
| Operator gas low | Admin Telegram alert |
| Message edited later | Edit is flagged; confirmed payment is not clawed back |
| Message deleted later | Bot cannot observe deletion; stored audit row remains |
| Both LLM providers fail | Processing throws after the message is stored; no payout is made and no content-based refusal is invented. Automatic classifier retry is not implemented in the current webhook path. |

The money path is designed to fail closed. Availability failure must not become an accidental payment.

## 17. Tests and CI

Current verified suite:

- **51 Vitest tests across 9 files**
- **7 Foundry Base-fork tests**
- **58 automated tests total**

Coverage includes:

- prefilter thresholds, hashes, SimHash, duplicates, floors, caps
- deterministic engine policy and holds
- prompt-injection safety and recipient isolation
- Telegram scoring, idempotency, edits, questions, room linking, migration, bot removal
- wallet validation and explicit replacement confirmation
- paymaster proxy validation and allowlist behavior
- permission hash parity and validation
- typed Base permission-status reads
- payout encoding
- sweeper release/revoke behavior
- payer happy path, repeat payout, over-cap revert, revoked permission, wrong operator, stray-token no-sweep behavior, operator rotation

CI on `main` and pull requests runs:

```text
npm ci --legacy-peer-deps
npm audit --audit-level=high
npx next typegen
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Contract job:

```text
forge test --fork-url https://mainnet.base.org
```

CI uses Node 22 and pins Foundry `v1.0.0` for the current Base-fork environment.

## 18. Design invariants

| Invariant | Why it matters |
|---|---|
| Recipient comes only from stored wallet linkage | Message prompt injection cannot redirect funds |
| Model output never contains an execution target | LLM cannot construct arbitrary money-moving actions |
| Policy applies owner ranges and caps after the model | Model cannot bypass room policy |
| Spend permission is enforced on Base | App bugs cannot increase the onchain allowance |
| Permission status failures are treated as unsafe | RPC outages cannot be interpreted as permission to pay |
| Normal payer flow forwards the exact amount in one transaction | No intended custodial balance |
| Payer has no withdrawal/rescue path | Operator cannot sweep contract-held tokens |
| Owner mutations require fresh signatures | Public console visibility does not grant control |
| Telegram webhook is secret-authenticated and idempotent | Retries and unauthenticated calls cannot duplicate payouts |
| Edits are recorded rather than silently rewriting history | Audit trail remains honest after payment |

## 19. ADRs

### ADR-1: Base Account spend permissions as the budget rail

Decision: project budgets remain in the owner's Base Account under a revocable, per-period spend permission.

Consequence: current room-owner onboarding requires a Base Account rather than a plain EOA.

### ADR-2: Minimal payer contract as spender

Decision: the permission names `OvrythPayer`, not the operator EOA, as spender.

Consequence: one restricted contract is the spend surface, and the operator cannot directly pull project funds.

### ADR-3: Permission registration is chain-state aware

Decision: current onboarding uses Coinbase's hosted spend-permission consent. The payout path still checks whether approval exists and can call `approveWithSignature` inside `pay()` when needed.

Consequence: docs must not promise universally gasless owner onboarding. The current hosted permission-manager flow is account-paid.

### ADR-4: Deterministic policy over model output

Decision: the model classifies and proposes. Owner-defined category ranges, confidence, caps, allowance, and wallet state determine the application result.

Consequence: category minimum normalization may raise a too-low model proposal to the owner's minimum, while all ceilings can still reduce or refuse the result.

### ADR-5: Inline post-response processing plus sweeper

Decision: webhook work runs through `after()` and operational retries/status polling run through `/api/tick`.

Consequence: there is no separate message-queue vendor in the current deployment.

### ADR-6: Fail closed on money and chain truth

Decision: when permission state cannot be verified, do not pay.

Consequence: temporary availability loss is preferred to an unsafe transfer.

### ADR-7: No custodial contributor balance

Decision: approved work with no payout wallet becomes a 72-hour hold rather than an internal account balance.

Consequence: funds remain in the project account until a real payout transaction occurs.

## 20. Known implementation boundaries

- Telegram account age is approximate, not an authoritative identity signal.
- Telegram deletions cannot be observed after the fact.
- Edits are flagged and do not reverse confirmed transfers.
- The current rate limiter is in memory and should be replaced for horizontally scaled production.
- Both classifier providers are external dependencies. A total classifier outage currently stops that contribution's processing after storage and does not have an automatic model retry queue.
- CDP sponsorship policy is partly deployment configuration outside the repository.
- The public showcase is a demo room and should not be presented as external traction.

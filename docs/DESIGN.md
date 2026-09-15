# Ovryth Design

Version 1.2, 2026-09-15. Editorial light. Ovryth is built around one object, the weekly budget bar, which is the first screenshot, the OG image, and the thing a viewer remembers. The product is about money moving for work, so the visual language is a ledger: hairlines, tabular numerals, verdict colours that always come with a word, no decoration, no serif.

Banned words anywhere in the UI: tip, reward, engagement, incentive, gamify, success, AI-powered. Use paid, refused, held, budget, rules, work.

## 1. Design system

Canvas and text
- Canvas #ffffff, panel #f7f6f2 (warm paper), hairline #ebe9e4, text #0b0c0d, muted #6a6e6b, faint #9a9e9a.
- Accent (paid) #0b7a4b; accent tint #e6f4ec. Refusal (rust) #b3441c; refusal tint #f8e9e2. Hold (amber) #9a6a08; tint #f7efd9. Revoked (slate) #4a5057.
- All text on canvas meets AA. Green and rust are never the only signal; every verdict also has a glyph and a word.

Typography
- Open Runde 400/500/600 for UI (loaded via @fontsource, never synthesized). No serif anywhere.
- Geist Mono for amounts, addresses, hashes, timestamps, reason codes. Tabular numerals on.
- Scale: 13 mono captions, 14 body small, 16 body, 20 h3, 28 h2, 44 h1 desktop / 32 mobile. Line height 1.5 body, 1.15 headings.

Spacing and shape
- 4px base; common steps 8, 12, 16, 24, 32, 48, 72.
- Container 1064px, two vertical hairline rails at the container edges from 1100px up.
- Radius 6px on inputs and buttons, 10px on cards. No shadows except a 1px hairline; focus ring 2px #0b7a4b offset 2px.

Motion
- 150ms ease-out on state changes only. No decorative animation. When a payout confirms, one new segment grows into the budget bar over 400ms and the row appears with a single tint fade. Nothing else moves.

## 1b. The identity object: BudgetBar

One horizontal bar, 100 percent width of the container, height 28 on desktop and 20 on mobile, paper #f7f6f2 background with a hairline. Left edge is zero, right edge is the weekly cap. Paid amounts are green #0b7a4b segments laid left to right in payout order, separated by 1px white gaps. Every refusal is a 1px rust #b3441c tick beneath the bar at the moment in the week it happened (time axis under the bar, Monday to reset). An over-cap revert is a single rust marker just past the cap line with a mono label "reverted". Holds are amber hatched segments after the last paid segment. The cap line is a 2px ink vertical at the right edge with the mono figure above it. Under the bar, left: "paid this week 41.50 / 100 USDC" in mono; right: "resets Mon 00:00 UTC". Revoked rooms render the bar in slate with the label "revoked" and the tx link. Empty room: empty bar, cap line, "first real contribution gets paid" in muted.

The bar renders identically on the room page, the console, the landing (showcase room), and the OG image (1200x630, bar centered, room name above, figures below, mark bottom right).

## 2. Components

Button: primary (ink background, white text), secondary (hairline border), ghost. States: default, hover (ink 90 percent), active, disabled (faint), loading (spinner, label kept). Min height 40.

Input: mono for addresses and amounts, sans for text. Label always visible above. Error line in rust below. Helper line in muted.

Pill: mono 13, hairline border, tinted by kind (paid, refused, hold, revoked, info).

VerdictRow: the core ledger row. Grid on md: [time mono 13] [member @handle] [category pill] [amount mono, right aligned, green for paid, dash for refusal] [reason text] [tx link glyph]. Stacks on mobile with amount first. Hover reveals the full reason.

PermissionCard: account (truncated 0xAb…43e9 with copy), spender (payer contract, linked), allowance per week, remaining this period as a horizontal bar with mono figures, next reset, end date, status pill, BaseScan link to the manager.

RulesPanel: category table (label, pay range), floors line, owner free text in a quote block, version and effective time in mono.

StatusBanner: full-width hairline box for paused, revoked, expired, pending_onchain, wrong network. Word plus glyph plus one sentence plus the relevant link.

WalletConnect: disconnected (button "Connect Base Account"), connecting (spinner), connected (address pill with copy). If the connected wallet is not a Base Account smart wallet: banner "Spend permissions need a Base Account" with link. When the connected account is not the room owner: banner names the expected owner address.

WrongNetworkBanner: shown when chain is not 8453 with a "Switch to Base" button.

TxState: inline, not modal: idle, awaiting signature, pending (hash shown as soon as known), confirmed (block, link), failed (friendly reason, retry). Raw wallet and SDK errors never render verbatim; they map through the shared `friendlyError` helper.

EmptyState: one sentence plus one action. Room with no payouts yet: "No payouts yet this week. Rules are live. First real contribution gets paid." Not connected: "Connect the project's Base Account to begin."

AddressDisplay: 0xAbcd…43e9, copy on click, tooltip "copied".

AmountDisplay: mono, 2 decimals, "USDC" suffix in muted, right aligned in tables.

## 3. Screens

### Landing `/`
1. Header: mark + "Ovryth", nav (Demo room, Proof, Docs, GitHub, X), "Open a room" primary.
2. Hero: H1 (Open Runde 500, 44) "An agent that pays for real work. Never past your cap." Sub explaining the agent reads, decides, and pays within the on-chain cap. Below the sub, full width: the showcase room's live BudgetBar. Under it, the last three VerdictRows (one refusal among them if available) and the real pinned questions from the demo room.
3. Get paid in two minutes: five numbered steps with the demo group link, the `/wallet` command, and the expected reply. This block sits above everything else about the product because it is the fastest way to see it work.
4. Custody: one diagram row with real addresses: Project account -> SpendPermissionManager 0xf852…67Ad -> OvrythPayer -> Member, caption "one transaction, nothing rests in between", one real tx hash traced, link to the verified payer contract. Under it, three sentences on what Ovryth deliberately does not do (no treasury wallet, no leaderboard or XP, no moderation) and why.
5. Comparison: the table (Ovryth, Valor, Zealy AI review) rendered plainly, dated.
6. External room: the owner's room BudgetBar, their account address, one quote with permission.
7. Footer: links, chain id 8453 stated, honesty notes (demo accounts labelled, account age approximated, EOAs unsupported).

No statistics rail, no three-column "how it works", no marketing section.

### Onboard `/onboard`
Stepper, one column, 560px.
1. Connect Base Account (WalletConnect component, wrong network banner).
2. Link Telegram group: instruction "Add @ovryth_bot as admin, then send /link in the group", code field auto-fills when the bot receives it (poll every 3 s).
3. Budget: weekly allowance input (10 to 5,000 USDC), period fixed at 7 days, end 90 days shown, spender shown as the payer contract with link. Button "Sign permission". TxState: awaiting signature, then "Permission signed. Registers on chain with the first payout." with the hash.
4. Rules: RulesPanel in edit mode with three default categories prefilled (support answer 0.50 to 3, translation 2 to 10, guide 5 to 25), member weekly cap 25, floors 30 days account age, 3 days tenure, free text placeholder. Button "Open room".
5. Done: room slug, public page link, console link, what happens next.

### Console `/console/[slug]`
Header with room name and status pill. BudgetBar full width. Left: PermissionCard, pause toggle (signature required), in-console revoke button (one signature via the paymaster-sponsored wallet call, verified on chain before the room flips). Right: RulesPanel in edit mode showing the current version number and effective time (no history list). Below: this week's ledger (VerdictRows), operator notes (last tick, pending jobs, operator gas).

### Room page `/r/[slug]`
1. Header: room name, token, status pill, "demo room" or "external room, owner 0x…" label, "Verify on BaseScan" link to the manager.
2. Get paid in two minutes: the five steps (join, `/wallet 0x…`, answer a pinned question, paid reply with tx, optional copy from a second account gets refused), the pinned questions listed, expected reply shown as a real example row.
3. BudgetBar.
4. PermissionCard.
5. This week: two tabs, Paid and Refused, each a VerdictRow list. Paid rows link to tx and show "edited after payment" where applicable. Refused rows show reason and no amount. Demo accounts carry a label.
6. RulesPanel (read mode).
7. Proof strip: latest payout tx, latest over-cap revert tx (if any), latest revoke (if any), latest status check time, payer contract link, link to /proof.
8. All time totals in mono.
OG image: the BudgetBar with room name and figures.

### Proof page `/proof`
Six rows, each: label, hash or address (mono, break-all), block, BaseScan link, one sentence on what it proves. Rows: permission approval, capped payout, over-cap revert, revoke, OvrythPayer verified source, last sweeper tick. Revalidates every 60 seconds so newly recorded artifacts appear without a redeploy. `GET /api/proof` returns the same rows as JSON. No prose above the table beyond one line.

### Telegram surfaces
- In-thread paid reply: "Paid 2.50 USDC for translation. Reason: full FAQ translated to PT-BR. tx 0x1a2b…9c (BaseScan link)". One line, no emoji.
- In-thread refusal: "Not paid: copy of an earlier message." Reason set fixed: duplicate, off-topic, no substance, boilerplate, account too new, tenure too short, weekly cap reached, no linked wallet (with DM prompt).
- Budget reached: "This room's weekly budget is spent. The cap resets every 7 days."
- DM: /wallet 0x… (validates, confirms), /rules (link to the room page). No /history.
- Pinned question format in the demo room: "#question What does the OvrythPayer contract prevent, and how would you check it on BaseScan?" Three of these, pinned.

The memorable screenshot: a Telegram thread showing a member's answer, the bot's "Paid 2.50 USDC…" reply with the tx link, and directly under it a second member's copy with "Not paid: copy of an earlier message." This image belongs in the README and the demo video.

## 4. User flows

Owner: landing -> Open a room -> connect -> add bot, /link -> allowance, sign -> rules -> room live -> console.
Contributor: sees a paid reply in the group -> DMs /wallet -> posts work -> paid reply with tx.
Observer: demo link lands on the room page -> reads the five steps -> joins the group -> DMs /wallet -> answers a pinned question -> paid reply with tx within minutes -> opens BaseScan, sees the transfer from the project account -> optionally copies the answer from another account, refused -> back on the page, sees both rows and the bar segment -> /proof.

## 5. Responsive rules

- Mobile first. Container padding 16 under 640, 24 to 1024, rails only from 1100.
- VerdictRow stacks under md: amount and verdict first line, member and category second, reason third, tx link last.
- PermissionCard: bar full width, figures wrap to two lines under 480.
- Every address and hash uses `break-all` inside mono spans; no horizontal overflow at 360.
- Tables become stacked definition lists under 640.

## 6. Accessibility

AA contrast throughout, visible labels, focus rings, live region for the ledger updates on the room page, skip link, no colour-only meaning, all links with descriptive text (never "here").

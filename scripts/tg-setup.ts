/**
 * npm run tg:setup
 * Registers the bot's command menu and descriptions (idempotent). Run once, or after copy changes.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { tg } from "../src/lib/telegram/api";

async function main() {
  await tg("setMyCommands", {
    commands: [
      { command: "wallet", description: "Link your Base payout address: /wallet 0x…" },
      { command: "rules", description: "See the rooms you're in and their rules" },
    ],
  });
  await tg("setMyShortDescription", { short_description: "Payroll for real community work. Paid in USDC, on Base." });
  await tg("setMyDescription", {
    description: "Ovryth pays members who do real work in this community, in USDC on Base, within minutes. Link your wallet with /wallet 0x… and contribute. Farming is refused in public; the project can never spend past its weekly cap.",
  });
  console.log("Telegram commands and descriptions set.");
}

main().catch((e) => { console.error("tg:setup failed:", e instanceof Error ? e.message : e); process.exit(1); });

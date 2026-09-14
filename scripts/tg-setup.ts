/**
 * npm run tg:setup
 * Registers the bot's command menu and descriptions (idempotent). Run once, or after copy changes.
 * This is the single source of truth for the public command menu — keep it in sync with the
 * handlers in src/lib/telegram (handle.ts in-group, dm.ts direct).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { tg } from "../src/lib/telegram/api";

async function main() {
  await tg("setMyCommands", {
    commands: [
      { command: "start", description: "How Ovryth works and how to get paid" },
      { command: "wallet", description: "Link your Base payout address: /wallet 0x…" },
      { command: "rules", description: "See your rooms and what counts as paid work" },
      { command: "link", description: "Bind this group to a room (owner): /link CODE" },
    ],
  });
  await tg("setMyShortDescription", { short_description: "Community payroll. Real work, paid in USDC on Base - never past the weekly cap." });
  await tg("setMyDescription", {
    description:
      "Ovryth is community payroll. Do real work in a group where Ovryth is active and get paid in USDC on Base, within minutes. The project funds it from its own account and an on-chain weekly cap means it can never overspend.\n\nLink your payout address with /wallet 0xYourBaseAddress, then contribute. Low-effort or copied work is refused in public with the reason.",
  });
  console.log("Telegram commands and descriptions set.");
}

main().catch((e) => { console.error("tg:setup failed:", e instanceof Error ? e.message : e); process.exit(1); });

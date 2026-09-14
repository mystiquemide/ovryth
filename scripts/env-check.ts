/**
 * npm run env:check
 * Prints each required variable as SET or MISSING. Never prints values.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const REQUIRED = [
  "PUBLIC_ORIGIN",
  "NEXT_PUBLIC_CHAIN_ID",
  "BASE_RPC_URL",
  "USDC_ADDRESS",
  "SPEND_PERMISSION_MANAGER",
  "NEXT_PUBLIC_PAYER_ADDRESS",
  "OVRYTH_OPERATOR_PRIVATE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "TELEGRAM_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "TICK_SECRET",
] as const;

const OPTIONAL = [
  "BASE_RPC_FALLBACK_1",
  "BASE_RPC_FALLBACK_2",
  "TELEGRAM_ADMIN_CHAT_ID",
  "ETHERSCAN_API_KEY",
  "SHOWCASE_ROOM_SLUG",
] as const;

let missing = 0;
console.log("Required:");
for (const k of REQUIRED) {
  const set = !!process.env[k] && process.env[k]!.length > 0;
  if (!set) missing++;
  console.log(`  ${set ? "SET    " : "MISSING"}  ${k}`);
}
console.log("Optional:");
for (const k of OPTIONAL) {
  const set = !!process.env[k] && process.env[k]!.length > 0;
  console.log(`  ${set ? "SET    " : "unset  "}  ${k}`);
}
console.log(missing === 0 ? "\nAll required variables set." : `\n${missing} required variable(s) missing.`);
process.exit(missing === 0 ? 0 : 1);

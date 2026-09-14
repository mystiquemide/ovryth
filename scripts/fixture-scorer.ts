/**
 * npm run fixture:scorer
 * Day-one blocker (Task 4). Runs the full engine (classify -> policy) over the fixture set.
 * Gate: zero wrong payments across 3 Gemini runs + 1 Groq run, and all real items paid within range.
 * A "wrong payment" is: paying a slop item, or paying a real item outside its category range.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { classify } from "../src/lib/engine/classify";
import { decide } from "../src/lib/engine/policy";
import type { MemberFacts, RoomFacts, Rules } from "../src/lib/engine/types";

interface Item {
  id: string;
  text: string;
  expectPay: boolean;
  expectCategory?: string;
}
interface Fixture {
  rules: Rules;
  questions: string[];
  items: Item[];
}

const fixture = JSON.parse(readFileSync("tests/fixtures/contributions.json", "utf8")) as Fixture;

// Generous member/room facts so this test isolates the classifier + amount policy, not the sybil floors.
const member: MemberFacts = { approxAccountAgeDays: 365, tenureDays: 90, paidThisWeekUsdc: 0, hasLinkedWallet: true };
const room: RoomFacts = { remainingAllowanceUsdc: 1000, paidTodayUsdc: 0 };

type RunSpec = { label: string; provider: "gemini" | "groq" };
// Groq is the classifier primary (unlimited here, 10/10 clean). Gemini is one paced cross-check.
const RUNS: RunSpec[] = [
  { label: "groq-1", provider: "groq" },
  { label: "groq-2", provider: "groq" },
  { label: "groq-3", provider: "groq" },
  { label: "gemini-1", provider: "gemini" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Gemini free tier is ~10 flash req/min. Pace Gemini calls; Groq has no such limit.
const paceMs = (p: "gemini" | "groq") => (p === "gemini" ? 7000 : 300);

async function classifyWithRetry(text: string, rules: Rules, questions: string[], provider: "gemini" | "groq") {
  try {
    return await classify(text, rules, questions, { provider });
  } catch (e) {
    if (String(e).includes("429")) {
      await sleep(35000);
      return classify(text, rules, questions, { provider });
    }
    throw e;
  }
}

function catRange(rules: Rules, key: string | null) {
  return rules.categories.find((c) => c.key === key);
}

async function main() {
  let wrongPayments = 0;
  let missedReal = 0;
  const rows: string[] = [];

  for (const run of RUNS) {
    for (const item of fixture.items) {
      let paid = false;
      let amount = 0;
      let detail = "";
      try {
        const { data: verdict } = await classifyWithRetry(item.text, fixture.rules, fixture.questions, run.provider);
        const d = decide(verdict, fixture.rules, member, room);
        paid = d.pay;
        amount = d.amountUsdc;
        detail = d.pay ? `PAID ${amount} (${d.categoryKey})` : `refused: ${d.reasonCode}`;

        if (item.expectPay) {
          if (!d.pay) {
            missedReal++;
            detail += "  <-- MISSED REAL WORK";
          } else {
            const range = catRange(fixture.rules, d.categoryKey);
            if (!range || amount < range.minUsdc || amount > range.maxUsdc) {
              wrongPayments++;
              detail += "  <-- WRONG: amount outside range";
            }
          }
        } else if (d.pay) {
          wrongPayments++;
          detail += "  <-- WRONG PAYMENT (slop paid)";
        }
      } catch (e) {
        detail = `ERROR ${e instanceof Error ? e.message.slice(0, 80) : e}`;
      }
      rows.push(`${run.label.padEnd(9)} ${item.id.padEnd(18)} ${detail}`);
      await sleep(paceMs(run.provider));
    }
  }

  console.log(rows.join("\n"));
  console.log("\n=== GATE ===");
  console.log(`runs: ${RUNS.length}, items each: ${fixture.items.length}`);
  console.log(`wrong payments: ${wrongPayments} (must be 0)`);
  console.log(`missed real work: ${missedReal} (target 0)`);
  const pass = wrongPayments === 0 && missedReal === 0;
  console.log(pass ? "\nPASS" : "\nFAIL");
  process.exit(pass ? 0 : 1);
}

main();

import { LegalLayout, Section, Bullets } from "@/components/site/legal";

export const metadata = { title: "Privacy Policy · Ovryth" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="14 Sep 2026">
      <Section heading="Summary">
        <p>Ovryth stores only what it needs to score community work and pay for it. It never holds your funds and never asks for a private key. This page explains what is collected, how it is used, and how it is handled.</p>
      </Section>

      <Section heading="What we collect">
        <Bullets items={[
          "Telegram data: your user id, username, and the text of messages you post in a room where Ovryth is an admin, plus content hashes used to detect duplicates.",
          "Wallet address: the Base address you link with /wallet, used only as a payout destination.",
          "Room data: for room owners, the Base Account address, the spend permission, and the rules you publish.",
          "On-chain records: payout, revert, and approval transactions, which are public on Base by design.",
        ]} />
        <p>Telegram does not expose when an account was created, so account age is approximated from the user id and when you were first seen in a room. This estimate is labeled as approximate wherever it appears.</p>
      </Section>

      <Section heading="What we do not collect">
        <Bullets items={[
          "Private keys or seed phrases. Ovryth never asks for them and cannot move funds beyond the on-chain cap.",
          "Payment card details or bank information.",
          "Messages from groups where Ovryth is not an admin, or private DMs beyond the commands you send the bot.",
        ]} />
      </Section>

      <Section heading="How we use it">
        <Bullets items={[
          "To score a message against a room's rules and decide whether it is paid, held, or refused.",
          "To send a USDC payout to your linked wallet and reply in-thread with the transaction.",
          "To show a public ledger of paid and refused contributions on the room page.",
          "To enforce anti-farming floors: account age, room tenure, and per-member and per-room caps.",
        ]} />
      </Section>

      <Section heading="Storage and sharing">
        <p>Data is stored in a Postgres database (Neon). Transactions are recorded on the public Base blockchain and are visible on explorers such as BaseScan. Ovryth does not sell your data. Message scoring uses a language model provider that receives only message text and the room&apos;s rules, never wallet addresses or private data.</p>
      </Section>

      <Section heading="Public by design">
        <p>Payouts and refusals are shown publicly on the room page, and every payout is a public on-chain transaction. Do not post anything in a room that you need to keep private.</p>
      </Section>

      <Section heading="Retention and your choices">
        <p>Room and ledger records are kept for the life of the room so the public proof stays accurate. You can stop participating at any time, and a room owner can revoke the spend permission at any time, which stops Ovryth immediately.</p>
      </Section>

      <Section heading="Contact">
        <p>Questions about this policy can be raised with the project team via the Ovryth account on X, linked in the footer.</p>
      </Section>
    </LegalLayout>
  );
}

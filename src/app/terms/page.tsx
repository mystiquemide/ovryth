import { LegalLayout, Section, Bullets } from "@/components/site/legal";

export const metadata = { title: "Terms of Service · Ovryth" };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="14 Sep 2026">
      <Section heading="Agreement">
        <p>By using Ovryth, whether to earn in a room or to run one, you agree to these terms. If you do not agree, do not use the product.</p>
      </Section>

      <Section heading="What Ovryth is">
        <p>Ovryth is software that helps a project pay members for real work in its Telegram, in USDC on Base, within a weekly cap enforced on chain. Ovryth is non-custodial: it never holds funds and cannot spend beyond the permission a project grants.</p>
      </Section>

      <Section heading="Eligibility">
        <p>You must be able to form a binding agreement and must comply with the laws that apply to you. Do not use Ovryth where doing so is prohibited.</p>
      </Section>

      <Section heading="If you earn in a room">
        <Bullets items={[
          "You are responsible for the wallet address you link. Payouts go to that address and on-chain transactions are final.",
          "Post genuine work. Copying, spam, prompt injection, and attempts to farm payouts are refused and may exclude you from a room.",
          "Amounts and addresses written in a message never change a payout. Recipients come only from the wallet you link in a DM.",
        ]} />
      </Section>

      <Section heading="If you run a room">
        <Bullets items={[
          "You fund and control the budget in your own Base Account and set the rules for what counts as work.",
          "You grant a capped, revocable spend permission and can revoke it at any time from your account.",
          "You are responsible for your rules, your community, and complying with the laws that apply to you.",
        ]} />
      </Section>

      <Section heading="Payments and finality">
        <p>Payouts are on-chain transfers on Base and are irreversible once confirmed. A payout past the weekly cap reverts on chain. Network conditions, RPC availability, and model or provider issues can delay or prevent a payout; Ovryth fails closed and does not pay when it cannot verify state.</p>
      </Section>

      <Section heading="No warranties">
        <p>Ovryth is provided as is, without warranties of any kind. It is offered as a hackathon-stage build and may change or be unavailable. Nothing here is financial, legal, or tax advice.</p>
      </Section>

      <Section heading="Limitation of liability">
        <p>To the maximum extent permitted by law, Ovryth and its contributors are not liable for lost funds, missed or delayed payouts, or any indirect or consequential damages arising from use of the product or the underlying blockchain.</p>
      </Section>

      <Section heading="Changes">
        <p>These terms may be updated. Continued use after a change means you accept the updated terms.</p>
      </Section>

      <Section heading="Contact">
        <p>Questions can be raised with the project team via the Ovryth account on X, linked in the footer.</p>
      </Section>
    </LegalLayout>
  );
}

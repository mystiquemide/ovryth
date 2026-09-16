import { TelegramThread } from "@/components/TelegramThread";
import { getShowcase } from "@/lib/showcase";
import { SHOWCASE_SLUG } from "@/lib/room-view";

const BOT_URL = "https://t.me/Ovryth_bot";
const GROUP_URL = "https://t.me/ovryth_demo_room";

const STEPS = [
  { n: "1", title: "Join the demo room", body: "The Ovryth agent is live there, reading contributions and applying the room's rules." },
  { n: "2", title: "Inspect the rules", body: "The live room shows its payout ranges, account-age floor, tenure floor, and weekly cap." },
  { n: "3", title: "Inspect a real payout", body: "Open a paid contribution and follow its BaseScan link to the real USDC transfer." },
  { n: "4", title: "Inspect a refusal", body: "The demo also shows low-quality and duplicate work refused in public with a reason." },
  { n: "5", title: "Try the agent", body: "DM /wallet and contribute if eligible. New participants remain subject to the room's eligibility rules." },
];

export async function JudgePath() {
  const showcase = await getShowcase(SHOWCASE_SLUG);

  return (
    <section className="bg-snow px-6 py-20 md:py-24">
      <div className="mx-auto max-w-[1064px]">
        <p className="eyebrow">Try it</p>
        <h2 className="h1 mt-3 max-w-[640px]">See Ovryth work</h2>
        <p className="body-lg mt-4 max-w-[620px] text-smoke">
          Explore real paid and refused contributions from the demo room, inspect every payout on Base, or join the
          Telegram room to interact with the agent. New contributors are subject to the room&apos;s eligibility rules,
          so joining now does not guarantee an immediate payout.
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_460px] lg:gap-16">
          <ol className="space-y-6">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-mist bg-paper text-[14px] text-ink">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">
                    {s.n === "1" ? (
                      <a href={GROUP_URL} target="_blank" rel="noreferrer" className="text-link hover:underline">
                        {s.title} ↗
                      </a>
                    ) : s.title}
                  </h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-smoke">{s.body}</p>
                </div>
              </li>
            ))}

            <li className="flex gap-4">
              <span className="h-8 w-8 shrink-0" />
              <a href={BOT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-pill bg-midnight px-[18px] py-[11px] text-[14px] font-medium text-white shadow-[var(--shadow-button)] transition-colors hover:bg-carbon">
                Open @Ovryth_bot →
              </a>
            </li>
          </ol>

          <div className="space-y-6">
            {showcase && showcase.questions.length > 0 && (
              <div className="rounded-card border border-mist bg-paper p-5">
                <div className="eyebrow mb-3 text-fog">Pinned questions</div>
                <ul className="space-y-3">
                  {showcase.questions.map((q, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] text-ink">
                      <span className="mono text-link">#</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TelegramThread
              paidTxHash={showcase?.examplePaidTxHash ?? null}
              paidAmount={showcase?.examplePaidAmount ?? null}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

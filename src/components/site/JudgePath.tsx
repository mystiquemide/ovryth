import { TelegramThread } from "@/components/TelegramThread";
import { getShowcase } from "@/lib/showcase";
import { SHOWCASE_SLUG } from "@/lib/room-view";

const BOT_URL = "https://t.me/Ovryth_bot";
const GROUP_URL = "https://t.me/ovryth_demo_room";

const STEPS = [
  { n: "1", title: "Join the room's Telegram group", body: "The Ovryth agent is an admin there, reading every message and paying for real work." },
  { n: "2", title: "DM the bot your wallet", body: "Send /wallet 0x… once. That address is where your USDC lands. Nothing else." },
  { n: "3", title: "Answer a pinned question", body: "Post a real, substantive answer to one of the pinned questions below." },
  { n: "4", title: "Get paid within minutes", body: "The agent replies in-thread with the amount, the reason, and a BaseScan link to the transfer." },
  { n: "5", title: "Try to game it", body: "Copy the answer from a second account. The agent refuses it in public, with the reason." },
];

export async function JudgePath() {
  const showcase = await getShowcase(SHOWCASE_SLUG);

  return (
    <section className="bg-snow px-6 py-20 md:py-24">
      <div className="mx-auto max-w-[1064px]">
        <p className="eyebrow">Try it</p>
        <h2 className="h1 mt-3 max-w-[640px]">Get paid in two minutes</h2>
        <p className="body-lg mt-4 max-w-[620px] text-smoke">
          This is the thing to actually do. Answer a real question in the group and the agent pays your own wallet,
          on Base, while you watch.
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

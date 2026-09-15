const COLS = [
  { key: "ovryth", name: "Ovryth", sub: "AI payroll agent" },
  { key: "zealy", name: "Zealy AI review", sub: "Plus plan" },
] as const;

type Row = { dim: string; ovryth: string; zealy: string };

const ROWS: Row[] = [
  {
    dim: "What runs it",
    ovryth: "An agent, end to end: it reads, decides, pays, and refuses with no human approving each payment.",
    zealy: "A quest platform; AI assists the review.",
  },
  {
    dim: "Who holds the budget",
    ovryth: "The project, in its own Base Account. Ovryth only touches each approved payout, once, in the payout transaction.",
    zealy: "Zealy platform balance.",
  },
  {
    dim: "Cap enforcement",
    ovryth: "On chain, per week, reverts when exceeded, revocable in one signature.",
    zealy: "Platform config.",
  },
  {
    dim: "Where members work",
    ovryth: "The project's existing Telegram.",
    zealy: "Zealy's site; members must join.",
  },
  {
    dim: "Refusals",
    ovryth: "Public, with a one-line reason, logged.",
    zealy: "Reviewer verdict inside Zealy.",
  },
  {
    dim: "Sybil floors",
    ovryth: "Account age, room history, per-member weekly cap.",
    zealy: "Follower and account-age gates on X tasks.",
  },
  {
    dim: "Rules",
    ovryth: "The project's own written rules.",
    zealy: "Quest prompts.",
  },
];

export function Comparison() {
  return (
    <section className="bg-snow px-6 py-20 md:py-24">
      <div className="mx-auto max-w-[1064px]">
        <p className="eyebrow">How it compares</p>
        <h2 className="h1 mt-3 max-w-[620px]">Named, not implied</h2>
        <p className="body-lg mt-4 max-w-[620px] text-smoke">Compared 14 Sep 2026. The difference that matters is custody: who can move the money, and how much.</p>

        <div className="mt-12 overflow-hidden rounded-panel border border-mist bg-paper">
          {/* Header (md+) */}
          <div className="hidden border-b border-mist md:grid md:grid-cols-[240px_1fr_1fr]">
            <div className="p-4" />
            {COLS.map((c) => (
              <div key={c.key} className={`p-4 ${c.key === "ovryth" ? "bg-snow" : ""}`}>
                <div className="text-[15px] font-semibold text-ink">{c.name}</div>
                <div className="mono mt-0.5 text-[12px] text-fog">{c.sub}</div>
              </div>
            ))}
          </div>

          {ROWS.map((r, i) => (
            <div key={r.dim} className={`grid grid-cols-1 md:grid-cols-[240px_1fr_1fr] ${i > 0 ? "border-t border-mist" : "md:border-t-0"}`}>
              <div className="bg-snow p-4 text-[14px] font-medium text-ink md:bg-transparent">{r.dim}</div>
              <div className="border-t border-mist p-4 text-[14px] text-ink md:border-t-0 md:bg-snow">
                <span className="mb-1 block text-[12px] font-medium text-fog md:hidden">Ovryth</span>
                {r.ovryth}
              </div>
              <div className="border-t border-mist p-4 text-[14px] text-smoke md:border-t-0">
                <span className="mb-1 block text-[12px] font-medium text-fog md:hidden">Zealy AI review</span>
                {r.zealy}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

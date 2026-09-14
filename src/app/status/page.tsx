import { Nav } from "@/components/site/Nav";
import { getSystemStatus, type State } from "@/lib/status";

export const metadata = { title: "Status · Ovryth" };
export const dynamic = "force-dynamic"; // always run live checks

const TONE: Record<State, { dot: string; text: string; label: string }> = {
  operational: { dot: "bg-paid", text: "text-paid", label: "Operational" },
  degraded: { dot: "bg-hold", text: "text-hold", label: "Degraded" },
  down: { dot: "bg-refused", text: "text-refused", label: "Down" },
};

const OVERALL: Record<State, string> = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  down: "Service disruption",
};

export default async function StatusPage() {
  const status = await getSystemStatus();
  const tone = TONE[status.overall];

  return (
    <>
      <Nav />
      <main id="main-content" className="mx-auto max-w-[820px] px-6 py-16">
        <p className="eyebrow">System status</p>

        <div className="mt-4 flex items-center gap-3">
          <span className={`h-3 w-3 rounded-pill ${tone.dot}`} aria-hidden />
          <h1 className="h1">{OVERALL[status.overall]}</h1>
        </div>
        <p className="mono mt-3 text-[13px] text-fog">
          Checked {new Date(status.checkedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC · live
        </p>

        <div className="mt-12 overflow-hidden rounded-panel border border-mist">
          {status.checks.map((c, i) => {
            const t = TONE[c.state];
            return (
              <div key={c.name} className={`flex items-center justify-between gap-4 px-5 py-4 ${i > 0 ? "border-t border-mist" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-pill ${t.dot}`} aria-hidden />
                  <span className="text-[15px] font-medium text-ink">{c.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden text-[13px] text-smoke sm:inline">{c.detail}</span>
                  <span className={`text-[13px] font-medium ${t.text}`}>{t.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-[13px] leading-relaxed text-fog">
          Checks run live each time this page loads: the web app and API, the Neon Postgres database, the Base mainnet
          RPC, the deployed OvrythPayer contract, and the Telegram bot. A green dot means the service responded and is
          operational.
        </p>
      </main>
    </>
  );
}

import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { baseScanTx, baseScanAddress, shortHash } from "@/lib/format";

const ACCOUNT = "0x708f281Ada585D116e57aCF650cb28B84e972996";
const MANAGER = "0xf85210B21cC50302F477BA56686d2019dC9b67Ad";
const PAYER = "0x485457f86fbf5e2385ae183bd5518c7d965e3999";
const MEMBER = "0xFfdf04aE758530f78Cd929523293756b6eE6Cd4b";
const TRACED_TX = "0x9d44d136f7ab6e6988c8f5e17a2d2c5a0b2a744f7d96b12267fb082239392270";

function Node({ label, address, sub }: { label: string; address: string; sub?: string }) {
  return (
    <div className="flex-1 rounded-card border border-mist bg-paper p-4">
      <div className="eyebrow mb-2 text-fog">{label}</div>
      <AddressDisplay value={address} />
      {sub && <div className="mt-1 text-[12px] text-fog">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-fog md:px-1" aria-hidden>
      <span className="hidden md:inline text-[18px]">→</span>
      <span className="md:hidden text-[18px]">↓</span>
    </div>
  );
}

const NOT_DOING = [
  { title: "No treasury wallet", body: "Ovryth never holds your funds. The budget stays in your Base Account until a single transaction pays a member." },
  { title: "No leaderboard or XP", body: "There are no points to farm. Ovryth pays for real work once, in USDC, and refuses everything else." },
  { title: "No moderation", body: "Ovryth does not police your community. It reads messages only to decide what counts as paid work." },
];

export function Custody() {
  return (
    <section className="px-6 py-20 md:py-24">
      <div className="mx-auto max-w-[1064px]">
        <p className="eyebrow">How the money moves</p>
        <h2 className="h1 mt-3 max-w-[680px]">Nothing rests in between</h2>
        <p className="body-lg mt-4 max-w-[620px] text-smoke">
          A payout is one on-chain transaction from your account to the member, authorized by a spend permission that
          Ovryth can never exceed. No pooled wallet, no float, no custody.
        </p>

        <div className="mt-12 flex flex-col gap-3 md:flex-row md:items-stretch">
          <Node label="Project Base Account" address={ACCOUNT} sub="holds the budget" />
          <Arrow />
          <Node label="SpendPermissionManager" address={MANAGER} sub="enforces the cap on chain" />
          <Arrow />
          <Node label="OvrythPayer" address={PAYER} sub="verified · cannot hold funds" />
          <Arrow />
          <Node label="Member wallet" address={MEMBER} sub="paid in USDC" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
          <span className="text-smoke">One transaction, nothing rests in between.</span>
          <a href={baseScanTx(TRACED_TX)} target="_blank" rel="noreferrer" className="mono text-link hover:underline">
            traced payout {shortHash(TRACED_TX)} ↗
          </a>
          <a href={`${baseScanAddress(PAYER)}#code`} target="_blank" rel="noreferrer" className="text-link hover:underline">
            verified payer contract ↗
          </a>
        </div>

        <div className="mt-16 grid gap-8 border-t border-mist pt-12 md:grid-cols-3">
          {NOT_DOING.map((x) => (
            <div key={x.title}>
              <h3 className="text-[17px] font-semibold text-ink">{x.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-smoke">{x.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Nav } from "@/components/site/Nav";
import { MinimalFooter } from "@/components/site/MinimalFooter";
import { getProofArtifacts } from "@/lib/proof";

export const metadata = { title: "Proof · Ovryth" };

export default async function ProofPage() {
  const rows = await getProofArtifacts();

  return (
    <>
      <Nav />
      <main id="main-content" className="mx-auto max-w-[1064px] px-6 py-16">
        <p className="eyebrow">On chain, not on trust</p>
        <h1 className="h1 mt-3 max-w-[620px]">Proof</h1>
        <p className="body-lg mt-4 max-w-[620px] text-smoke">
          Every claim Ovryth makes about custody resolves to a transaction on Base. Each row reads its hash from the
          database and links to BaseScan.
        </p>

        <div className="mt-12 overflow-hidden rounded-panel border border-mist">
          {rows.map((row, i) => (
            <div key={row.label} className={`grid grid-cols-1 gap-2 p-5 md:grid-cols-[200px_1fr] md:gap-6 ${i > 0 ? "border-t border-mist" : ""}`}>
              <div className="text-[15px] font-semibold text-ink">{row.label}</div>
              <div>
                {row.value ? (
                  row.href ? (
                    <a href={row.href} target="_blank" rel="noreferrer" className="mono block break-all py-2 text-[13px] text-link hover:underline">
                      {row.value} ↗
                    </a>
                  ) : (
                    <span className="mono block break-all text-[13px] text-ink">{row.value}</span>
                  )
                ) : (
                  <span className="text-[13px] text-fog">not yet</span>
                )}
                <p className="mt-2 text-[14px] leading-relaxed text-smoke">{row.note}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <MinimalFooter />
    </>
  );
}

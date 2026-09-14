import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main id="main-content" className="mx-auto max-w-[720px] px-6 py-16">
        <p className="eyebrow">Legal</p>
        <h1 className="h1 mt-3">{title}</h1>
        <p className="mono mt-3 text-[13px] text-fog">Last updated {updated}</p>
        <div className="mt-10">{children}</div>
      </main>
      <Footer />
    </>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-[20px] font-semibold text-ink">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-smoke">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((x) => (
        <li key={x} className="flex gap-2.5"><span className="text-link">·</span><span>{x}</span></li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/ui/Logo";

export const metadata = { title: "Page not found · Ovryth" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col px-6 py-10">
      <Link href="/" aria-label="Ovryth home" className="inline-block"><Wordmark size={24} /></Link>
      <div className="mx-auto flex max-w-[560px] flex-1 flex-col items-start justify-center py-24">
        <p className="eyebrow">404</p>
        <h1 className="h1 mt-3">This page isn&apos;t here</h1>
        <p className="body-lg mt-4 max-w-[440px] text-smoke">
          The link may be old or the room slug mistyped. The live room and proof are both public.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ButtonLink href="/room" variant="primary">See the live room →</ButtonLink>
          <ButtonLink href="/" variant="secondary">Back home</ButtonLink>
        </div>
      </div>
    </main>
  );
}

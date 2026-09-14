import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import { OnboardFlow } from "@/components/site/OnboardFlow";
import { MinimalFooter } from "@/components/site/MinimalFooter";

export const metadata = { title: "Open a room · Ovryth" };

export default function OpenRoomPage() {
  return (
    <>
      <main id="main-content" className="px-6 py-10">
        <div className="mx-auto max-w-[560px]">
          <div className="mb-10 flex items-center justify-between">
            <Link href="/" aria-label="Ovryth home"><Wordmark size={24} /></Link>
            <Link href="/onboard" className="text-[13px] text-smoke hover:text-ink">New here? Read onboarding →</Link>
          </div>
          <div className="mb-8">
            <p className="eyebrow">Open a room</p>
            <h1 className="h2 mt-2">Fund a cap, link your group, pay for real work</h1>
          </div>
          <OnboardFlow />
        </div>
      </main>
      <MinimalFooter />
    </>
  );
}

import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { OnboardFlow } from "@/components/site/OnboardFlow";

export const metadata = { title: "Open a room · Ovryth" };

export default function OnboardPage() {
  return (
    <>
      <Nav />
      <main className="px-6 py-16">
        <div className="mx-auto mb-10 max-w-[560px] text-center">
          <p className="eyebrow">Open a room</p>
          <h1 className="h1 mt-3">Fund a cap, link your group, pay for real work</h1>
        </div>
        <OnboardFlow />
      </main>
      <Footer />
    </>
  );
}

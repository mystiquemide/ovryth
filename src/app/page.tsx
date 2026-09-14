import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { JudgePath } from "@/components/site/JudgePath";
import { Custody } from "@/components/site/Custody";
import { Comparison } from "@/components/site/Comparison";
import { Footer } from "@/components/site/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main-content">
        <Hero />
        <JudgePath />
        <Custody />
        <Comparison />
      </main>
      <Footer />
    </>
  );
}

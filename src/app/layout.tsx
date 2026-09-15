import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "@fontsource/open-runde/400.css";
import "@fontsource/open-runde/500.css";
import "@fontsource/open-runde/600.css";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Ovryth is an AI agent that runs payroll inside a project's Telegram. It reads every contribution, decides what counts as real work under the project's rules, and pays members in USDC on Base within minutes, refusing the rest in public. The budget stays in the project's own Base Account, and the weekly cap is a line the agent can never cross.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://ovryth.vercel.app"),
  title: "Ovryth · AI payroll agent for token communities",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  icons: { apple: "/apple-touch-icon.png" },
  openGraph: {
    title: "Ovryth · AI payroll agent for token communities",
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ovryth - an AI payroll agent, capped on chain" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ovryth · AI payroll agent for token communities",
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-pill focus:bg-midnight focus:px-4 focus:py-2 focus:text-[14px] focus:text-white"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

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
  "Your project keeps the budget in its own Base Account. Ovryth pays members who do real work in your Telegram within minutes, refuses duplicate and low-effort work in public, and can never spend past your weekly cap.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://easily-synergy-canopener.ngrok-free.dev"),
  title: "Ovryth · Payroll for real community work",
  description: DESCRIPTION,
  openGraph: {
    title: "Ovryth · Payroll for real community work",
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ovryth - payroll for real community work, capped on chain" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ovryth · Payroll for real community work",
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

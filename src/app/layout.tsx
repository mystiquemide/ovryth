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

export const metadata: Metadata = {
  title: "Ovryth · Payroll for real community work",
  description:
    "Your project keeps the budget in its own Base Account. Ovryth pays members who do real work in your Telegram within minutes, refuses farmers in public, and can never spend past your weekly cap.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}

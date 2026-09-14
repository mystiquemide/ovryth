"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

const X_URL = "https://x.com/ovryth";

const LINKS: { href: string; label: string }[] = [
  { href: "/room", label: "Room" },
  { href: "/onboard", label: "Onboard" },
  { href: "/docs", label: "Docs" },
  { href: "/proof", label: "Proof" },
  { href: "/status", label: "Status" },
];

const linkCls =
  "inline-flex min-h-[44px] items-center rounded-pill px-3 text-[14px] text-smoke transition-colors duration-150 hover:bg-snow hover:text-ink";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkCls}>
      {children}
    </Link>
  );
}

function XMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

/** Floating pill nav: mark + wordmark, links, mobile menu, and the primary CTA. */
export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 px-4">
      <nav className="mx-auto max-w-[1064px] rounded-pill border border-mist bg-paper px-3 py-2 shadow-[var(--shadow-invoice)]">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="pl-2" aria-label="Ovryth home">
            <Wordmark size={26} />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.slice(0, 4).map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Ovryth on X"
              title="Ovryth on X"
              className="flex h-11 w-11 items-center justify-center rounded-pill text-smoke transition-colors duration-150 hover:bg-snow hover:text-ink"
            >
              <XMark />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ButtonLink href="/open" variant="primary">Open a room</ButtonLink>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center rounded-pill text-ink transition-colors hover:bg-snow md:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                {open ? (
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div id="mobile-nav" className="mt-2 flex flex-col gap-1 border-t border-mist pb-2 pt-2 md:hidden">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-[44px] items-center rounded-pill px-3 text-[15px] text-ink transition-colors hover:bg-snow"
              >
                {l.label}
              </Link>
            ))}
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-pill px-3 text-[15px] text-ink transition-colors hover:bg-snow"
            >
              Ovryth on X ↗
            </a>
          </div>
        )}
      </nav>
    </header>
  );
}

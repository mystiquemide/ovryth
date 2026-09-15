"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

const X_URL = "https://x.com/ovryth";
const GITHUB_URL = "https://github.com/mystiquemide/ovryth";

const LINKS: { href: string; label: string }[] = [
  { href: "/room", label: "Room" },
  { href: "/onboard", label: "Onboard" },
  { href: "/docs", label: "Docs" },
  { href: "/proof", label: "Proof" },
  { href: "/status", label: "Status" },
];

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-[44px] items-center rounded-pill px-3 text-[14px] transition-colors duration-150 hover:bg-snow hover:text-ink ${active ? "bg-snow font-medium text-ink" : "text-smoke"}`}
    >
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

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

/** Floating pill nav: mark + wordmark, links, mobile menu, and the primary CTA. */
export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href === "/room" && pathname.startsWith("/r/"));

  return (
    <header className="sticky top-4 z-50 px-4">
      <nav className="mx-auto max-w-[1064px] rounded-pill border border-mist bg-paper px-3 py-2 shadow-[var(--shadow-invoice)]">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="pl-2" aria-label="Ovryth home">
            <Wordmark size={26} />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.slice(0, 4).map((l) => (
              <NavLink key={l.href} href={l.href} active={isActive(l.href)}>
                {l.label}
              </NavLink>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Ovryth on GitHub"
              title="Ovryth on GitHub"
              className="flex h-11 w-11 items-center justify-center rounded-pill text-smoke transition-colors duration-150 hover:bg-snow hover:text-ink"
            >
              <GitHubMark />
            </a>
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
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center rounded-pill px-3 text-[15px] transition-colors hover:bg-snow ${isActive(l.href) ? "bg-snow font-medium text-ink" : "text-ink"}`}
              >
                {l.label}
              </Link>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-pill px-3 text-[15px] text-ink transition-colors hover:bg-snow"
            >
              Ovryth on GitHub ↗
            </a>
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

import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

/** Intended real destinations. Some routes are built in later sections. */
export const SHOWCASE_SLUG = "ovryth";
const GITHUB_URL = "https://github.com/mystiquemide/ovryth";
const X_URL = "https://x.com/ovryth";

function NavLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const cls = "rounded-pill px-3 py-2 text-[14px] text-smoke transition-colors duration-150 hover:bg-snow hover:text-ink";
  if (external) {
    return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  }
  return <Link href={href} className={cls}>{children}</Link>;
}

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-pill text-smoke transition-colors duration-150 hover:bg-snow hover:text-ink"
    >
      {children}
    </a>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

/** Floating pill nav: mark + wordmark, links, and the primary CTA. Solid, no glass. */
export function Nav() {
  return (
    <header className="sticky top-4 z-50 px-4">
      <nav className="mx-auto flex max-w-[1064px] items-center justify-between gap-4 rounded-pill border border-mist bg-paper px-3 py-2 shadow-[var(--shadow-invoice)]">
        <Link href="/" className="pl-2" aria-label="Ovryth home">
          <Wordmark size={26} />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <NavLink href={`/r/${SHOWCASE_SLUG}`}>Room</NavLink>
          <NavLink href="/proof">Proof</NavLink>
          <IconLink href={GITHUB_URL} label="Ovryth on GitHub"><GitHubMark /></IconLink>
          <IconLink href={X_URL} label="Ovryth on X"><XMark /></IconLink>
        </div>

        <ButtonLink href="/onboard" variant="primary">Open a room</ButtonLink>
      </nav>
    </header>
  );
}

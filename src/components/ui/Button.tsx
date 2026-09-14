import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2";

const sizes = "text-[14px] leading-none px-[18px] py-[11px] min-h-[44px]";

const variants: Record<Variant, string> = {
  // Near-black pill, never a colored fill.
  primary: "bg-midnight text-white shadow-[var(--shadow-button)] hover:bg-carbon",
  secondary: "bg-paper text-ink border border-mist hover:border-ink/40",
  ghost: "bg-transparent text-ink hover:bg-snow",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: Variant; className?: string; children: ReactNode } & ComponentPropsWithoutRef<"button">) {
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
  external,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = `${base} ${sizes} ${variants[variant]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

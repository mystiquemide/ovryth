"use client";

import { useEffect, useState } from "react";

/** Sticky docs sidebar with a scrollspy: highlights the section in view. */
export function DocsToc({ items }: { items: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState<string>(items[0]?.[0] ?? "");

  useEffect(() => {
    const heads = items
      .map(([id]) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-15% 0px -75% 0px" }
    );
    heads.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Docs sections" className="hidden lg:block">
      <div className="sticky top-24 space-y-2">
        {items.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={active === id ? "location" : undefined}
            className={`block text-[14px] transition-colors ${active === id ? "font-medium text-ink" : "text-smoke hover:text-ink"}`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

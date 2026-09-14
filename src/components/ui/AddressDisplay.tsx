"use client";

import { useState } from "react";
import { shortAddress, shortHash } from "@/lib/format";

/** Address or hash chip. Click to copy, with a brief "copied" confirmation. */
export function AddressDisplay({ value, kind = "address" }: { value: string; kind?: "address" | "hash" }) {
  const [copied, setCopied] = useState(false);
  const label = kind === "hash" ? shortHash(value) : shortAddress(value);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked; no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "copied" : value}
      className="mono inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-2 -mx-2 text-[13px] text-ink transition-colors duration-150 hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric focus-visible:ring-offset-2"
    >
      <span className="break-all">{label}</span>
      <span className="text-fog">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

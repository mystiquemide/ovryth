/** Format 6dp micro-USDC (bigint or number) as "12.50". */
export function formatUsdc(micro: bigint | number): string {
  const n = typeof micro === "bigint" ? Number(micro) / 1_000_000 : micro / 1_000_000;
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a plain USDC number (already in dollars) as "12.50". */
export function formatUsdcAmount(usdc: number): string {
  return usdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Truncate an address: 0xAbcd…43e9 */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Truncate a tx hash: 0x1a2b…9c3d */
export function shortHash(hash: string): string {
  if (!hash || hash.length < 12) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function baseScanTx(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}
export function baseScanAddress(addr: string): string {
  return `https://basescan.org/address/${addr}`;
}

import { getAddress, type Address } from "viem";

/** Base mainnet. Every address here is fixed and public; env only overrides the RPCs and payer. */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "8453");

export const USDC: Address = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
export const SPEND_PERMISSION_MANAGER: Address = getAddress(
  process.env.SPEND_PERMISSION_MANAGER ?? "0xf85210B21cC50302F477BA56686d2019dC9b67Ad",
);

/** Deployed OvrythPayer (the sole spender named in every permission). */
export const PAYER_ADDRESS: Address | undefined = process.env.NEXT_PUBLIC_PAYER_ADDRESS
  ? getAddress(process.env.NEXT_PUBLIC_PAYER_ADDRESS)
  : undefined;

/** Ordered RPC endpoints. mainnet.base.org is primary; the rest are fallbacks. */
export const RPC_URLS: string[] = [
  process.env.BASE_RPC_URL,
  process.env.BASE_RPC_FALLBACK_1,
  process.env.BASE_RPC_FALLBACK_2,
  "https://mainnet.base.org",
  "https://base.publicnode.com",
].filter((u): u is string => !!u);

/** Receipts are only trusted from the primary (publicnode rejects some archive-style receipt reads). */
export const RECEIPT_RPC_URL: string = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

export const USDC_DECIMALS = 6;

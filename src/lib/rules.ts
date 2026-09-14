import { z } from "zod";

/** USDC helpers: caps/amounts are stored on-chain-style as 6dp micro-USDC bigint. */
export function toMicroUsdc(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1_000_000));
}
export function fromMicroUsdc(micro: bigint): number {
  return Number(micro) / 1_000_000;
}

export const categorySchema = z.object({
  key: z.string().min(1).max(32),
  label: z.string().min(1).max(64),
  minUsdc: z.number().min(0).max(1000),
  maxUsdc: z.number().min(0).max(1000),
});

export const rulesInputSchema = z.object({
  categories: z.array(categorySchema).min(1).max(12),
  memberWeeklyCapUsdc: z.number().min(0).max(100000),
  roomDailyCapUsdc: z.number().min(0).max(100000),
  minAccountAgeDays: z.number().int().min(0).max(3650),
  minTenureDays: z.number().int().min(0).max(3650),
  freeText: z.string().max(2000).default(""),
});

export type RulesInput = z.infer<typeof rulesInputSchema>;

/** Defaults from DESIGN.md 4: three categories, member weekly cap 25, floors 30d/3d. */
export const DEFAULT_CATEGORIES = [
  { key: "support", label: "support answer", minUsdc: 0.5, maxUsdc: 3 },
  { key: "translation", label: "translation", minUsdc: 2, maxUsdc: 10 },
  { key: "guide", label: "guide", minUsdc: 5, maxUsdc: 25 },
] as const;

/**
 * Build a complete rules v1 from optional owner input. Room daily cap defaults to 30% of the
 * weekly allowance (PRD) so a judging-week rush cannot drain the week in an hour.
 */
export function buildRulesV1(allowanceMicroUsdc: bigint, input?: Partial<RulesInput>): RulesInput {
  const defaultDaily = fromMicroUsdc((allowanceMicroUsdc * 30n) / 100n);
  return rulesInputSchema.parse({
    categories: input?.categories ?? DEFAULT_CATEGORIES,
    memberWeeklyCapUsdc: input?.memberWeeklyCapUsdc ?? 25,
    roomDailyCapUsdc: input?.roomDailyCapUsdc ?? defaultDaily,
    minAccountAgeDays: input?.minAccountAgeDays ?? 30,
    minTenureDays: input?.minTenureDays ?? 3,
    freeText: input?.freeText ?? "",
  });
}

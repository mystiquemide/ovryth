import { createHash } from "node:crypto";
import type { ReasonCode } from "./types";

/**
 * Pre-filter and floors (ARCHITECTURE Path B, step 1). Pure functions run before any model
 * call so obvious non-work and already-capped members are refused cheaply. The policy layer
 * re-checks caps after the model (defense in depth); nothing here can approve a payment.
 */

export interface PrefilterConfig {
  minChars: number; // shortest message that could be real work
  minWords: number; // one-word / two-word messages are not work
  simhashMaxHamming: number; // near-duplicate threshold
  dailyRefusalLimit: number; // public refusals per member per day
}

export const DEFAULT_PREFILTER: PrefilterConfig = {
  minChars: 24,
  minWords: 3,
  simhashMaxHamming: 3,
  dailyRefusalLimit: 1,
};

export interface PrefilterMember {
  approxAccountAgeDays: number;
  tenureDays: number;
  paidThisWeekUsdc: number;
  publicRefusalsToday: number;
}

export interface PrefilterRoomRules {
  minAccountAgeDays: number;
  minTenureDays: number;
  memberWeeklyCapUsdc: number;
  roomDailyCapUsdc: number;
}

export interface PrefilterRoomFacts {
  paidTodayUsdc: number;
  remainingAllowanceUsdc: number;
}

export interface PrefilterInput {
  text: string;
  member: PrefilterMember;
  rules: PrefilterRoomRules;
  room: PrefilterRoomFacts;
  /** simhashes of the last ~500 room messages plus every paid message, room-wide. */
  priorSimhashes?: bigint[];
  /** exact content hashes seen before (fast path for verbatim copies). */
  priorContentHashes?: string[];
  config?: Partial<PrefilterConfig>;
}

export interface PrefilterResult {
  /** true = worth sending to the model; false = refuse now with reasonCode. */
  pass: boolean;
  reasonCode?: ReasonCode;
  contentHash: string;
  simhash: bigint;
  /** whether a public in-thread refusal is allowed today (else refuse silently). */
  canReplyPublicly: boolean;
  signals: {
    chars: number;
    words: number;
    linkOnly: boolean;
    hasCodeBlock: boolean;
    duplicate: boolean;
  };
}

const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
const CODE_BLOCK_RE = /```[\s\S]*?```|`[^`]+`/;

/** Normalize for hashing: lowercase, strip urls, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(URL_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex");
}

const MASK64 = (1n << 64n) - 1n;

/** 64-bit FNV-1a of a token. */
function fnv1a64(token: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < token.length; i++) {
    hash ^= BigInt(token.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & MASK64;
  }
  return hash;
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** 64-bit SimHash over word tokens. Similar texts produce a small Hamming distance. */
export function simhash(text: string): bigint {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0n;
  const v = new Array<number>(64).fill(0);
  for (const t of tokens) {
    const h = fnv1a64(t);
    for (let i = 0; i < 64; i++) {
      v[i] += (h >> BigInt(i)) & 1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let i = 0; i < 64; i++) {
    if (v[i] > 0) out |= 1n << BigInt(i);
  }
  return out;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = (a ^ b) & MASK64;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export function isNearDuplicate(sim: bigint, priors: bigint[], maxHamming: number): boolean {
  return priors.some((p) => hammingDistance(sim, p) <= maxHamming);
}

/**
 * Approximate a Telegram account's age in days from its numeric user id. Telegram ids are
 * assigned roughly monotonically over time, so this is an APPROXIMATION only (labelled as such
 * in the UI) and is combined with first-seen tenure. Larger id => younger account.
 */
export function approxAccountAgeDaysFromUserId(userId: bigint, nowMs: number = Date.now()): number {
  // Two coarse public anchors (id, unix ms). Linear interpolation/extrapolation, clamped >= 0.
  const A = { id: 100_000_000n, ms: Date.parse("2016-06-01T00:00:00Z") };
  const B = { id: 1_500_000_000n, ms: Date.parse("2021-01-01T00:00:00Z") };
  const idSpan = Number(B.id - A.id);
  const msSpan = B.ms - A.ms;
  const estMs = A.ms + ((Number(userId) - Number(A.id)) / idSpan) * msSpan;
  const ageDays = (nowMs - estMs) / 86_400_000;
  return Math.max(0, Math.round(ageDays));
}

export function prefilter(input: PrefilterInput): PrefilterResult {
  const cfg = { ...DEFAULT_PREFILTER, ...input.config };
  const text = input.text ?? "";
  const trimmed = text.trim();
  const withoutUrls = trimmed.replace(URL_RE, "").trim();
  const words = tokenize(text);

  const cHash = contentHash(text);
  const sim = simhash(text);

  const linkOnly = URL_RE.test(trimmed) && withoutUrls.length < cfg.minChars;
  URL_RE.lastIndex = 0; // reset stateful global regex
  const hasCodeBlock = CODE_BLOCK_RE.test(text);
  const exactDup = (input.priorContentHashes ?? []).includes(cHash);
  const nearDup = isNearDuplicate(sim, input.priorSimhashes ?? [], cfg.simhashMaxHamming);
  const duplicate = exactDup || nearDup;

  const canReplyPublicly = input.member.publicRefusalsToday < cfg.dailyRefusalLimit;

  const base = {
    contentHash: cHash,
    simhash: sim,
    canReplyPublicly,
    signals: { chars: trimmed.length, words: words.length, linkOnly, hasCodeBlock, duplicate },
  };

  const fail = (reasonCode: ReasonCode): PrefilterResult => ({ pass: false, reasonCode, ...base });

  // Cheapest truths first.
  if (trimmed.length < cfg.minChars || words.length < cfg.minWords) return fail("NO_SUBSTANCE");
  if (linkOnly) return fail("NO_SUBSTANCE");
  if (duplicate) return fail("DUPLICATE");
  if (input.member.approxAccountAgeDays < input.rules.minAccountAgeDays) return fail("ACCOUNT_TOO_NEW");
  if (input.member.tenureDays < input.rules.minTenureDays) return fail("TENURE_TOO_SHORT");
  if (input.member.paidThisWeekUsdc >= input.rules.memberWeeklyCapUsdc) return fail("MEMBER_CAP");
  if (input.room.paidTodayUsdc >= input.rules.roomDailyCapUsdc) return fail("ROOM_DAILY_CAP");
  if (input.room.remainingAllowanceUsdc <= 0) return fail("ROOM_ALLOWANCE");

  return { pass: true, ...base };
}

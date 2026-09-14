/** Ovryth engine types. Money never rests on model output; the policy layer decides, the chain enforces. */

export interface Category {
  key: string;
  label: string;
  minUsdc: number;
  maxUsdc: number;
}

/** A room's rules, one version. Written by the owner, applied by the policy layer. */
export interface Rules {
  version: number;
  categories: Category[];
  memberWeeklyCapUsdc: number;
  roomDailyCapUsdc: number;
  minAccountAgeDays: number;
  minTenureDays: number;
  freeText: string;
}

/** The fixed set of reasons Ovryth can post. No free-form public reasons. */
export const REASON = {
  DUPLICATE: "copy of an earlier message",
  OFF_TOPIC: "off-topic",
  NO_SUBSTANCE: "no substance",
  BOILERPLATE: "boilerplate",
  ACCOUNT_TOO_NEW: "account too new",
  TENURE_TOO_SHORT: "room tenure too short",
  MEMBER_CAP: "weekly cap reached",
  ROOM_DAILY_CAP: "daily room budget reached",
  ROOM_ALLOWANCE: "weekly budget reached",
  NO_WALLET: "no linked wallet",
  ENGINE_UNAVAILABLE: "engine unavailable",
} as const;

export type ReasonCode = keyof typeof REASON;

/** What the model returns. It classifies and explains within the rule ranges. It never sees or sets a recipient. */
export interface ModelVerdict {
  categoryKey: string | null; // null = not payable work
  proposedAmountUsdc: number; // model's suggestion, clamped by policy
  reasonCode: ReasonCode;
  reasonText: string; // one short sentence, shown after the reason label
  confidence: number; // 0..1
}

/** Member facts the policy layer needs. Approximated fields are labelled as such in the UI. */
export interface MemberFacts {
  approxAccountAgeDays: number;
  tenureDays: number;
  paidThisWeekUsdc: number;
  hasLinkedWallet: boolean;
}

/** Room-level facts the policy layer needs, read from chain and the database. */
export interface RoomFacts {
  remainingAllowanceUsdc: number; // from getPermissionStatus
  paidTodayUsdc: number;
}

export interface Decision {
  pay: boolean;
  amountUsdc: number; // 0 when not paying
  reasonCode: ReasonCode;
  reasonText: string;
  categoryKey: string | null;
  hold: boolean; // approved work, no wallet: hold 72h rather than pay
  notes: string[]; // audit trail of what the policy layer did
}

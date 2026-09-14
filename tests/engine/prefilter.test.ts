import { describe, it, expect } from "vitest";
import {
  prefilter,
  contentHash,
  simhash,
  hammingDistance,
  isNearDuplicate,
  approxAccountAgeDaysFromUserId,
  type PrefilterInput,
} from "../../src/lib/engine/prefilter";

const REAL =
  "Translated the full onboarding FAQ into Portuguese and fixed the two broken links in the pinned message.";

function input(overrides: Partial<PrefilterInput> = {}): PrefilterInput {
  return {
    text: REAL,
    member: { approxAccountAgeDays: 400, tenureDays: 30, paidThisWeekUsdc: 0, publicRefusalsToday: 0 },
    rules: { minAccountAgeDays: 30, minTenureDays: 3, memberWeeklyCapUsdc: 20, roomDailyCapUsdc: 50 },
    room: { paidTodayUsdc: 0, remainingAllowanceUsdc: 100 },
    priorSimhashes: [],
    priorContentHashes: [],
    ...overrides,
  };
}

describe("prefilter pass", () => {
  it("passes a substantive, unique message from an eligible member", () => {
    const r = prefilter(input());
    expect(r.pass).toBe(true);
    expect(r.reasonCode).toBeUndefined();
    expect(r.canReplyPublicly).toBe(true);
  });
});

describe("text-quality floors", () => {
  it("refuses a too-short message", () => {
    expect(prefilter(input({ text: "gm" })).reasonCode).toBe("NO_SUBSTANCE");
  });
  it("refuses a one-word message", () => {
    expect(prefilter(input({ text: "thanks!!!!!!!!!!!!!!!!!!!!" })).reasonCode).toBe("NO_SUBSTANCE");
  });
  it("refuses a link-only message", () => {
    const r = prefilter(input({ text: "https://example.com/some/really/long/path?x=1" }));
    expect(r.reasonCode).toBe("NO_SUBSTANCE");
    expect(r.signals.linkOnly).toBe(true);
  });
});

describe("room-wide duplicate detection", () => {
  it("refuses an exact copy by content hash", () => {
    const priorContentHashes = [contentHash(REAL)];
    const r = prefilter(input({ priorContentHashes }));
    expect(r.reasonCode).toBe("DUPLICATE");
    expect(r.signals.duplicate).toBe(true);
  });

  it("refuses a copy of another member's paid answer with cosmetic changes (simhash)", () => {
    const paidSim = simhash(REAL);
    const cosmeticCopy = REAL.toUpperCase() + "  !!!"; // case/whitespace/punctuation only
    const r = prefilter(input({ text: cosmeticCopy, priorSimhashes: [paidSim] }));
    expect(r.reasonCode).toBe("DUPLICATE");
  });

  it("does not flag genuinely different work as duplicate", () => {
    const otherSim = simhash("Wrote a step-by-step guide for connecting a hardware wallet on mobile.");
    const r = prefilter(input({ priorSimhashes: [otherSim] }));
    expect(r.pass).toBe(true);
  });
});

describe("sybil and cap gates", () => {
  it("refuses an account below the age floor", () => {
    expect(prefilter(input({ member: { approxAccountAgeDays: 5, tenureDays: 30, paidThisWeekUsdc: 0, publicRefusalsToday: 0 } })).reasonCode).toBe(
      "ACCOUNT_TOO_NEW",
    );
  });
  it("refuses a member below the tenure floor", () => {
    expect(prefilter(input({ member: { approxAccountAgeDays: 400, tenureDays: 1, paidThisWeekUsdc: 0, publicRefusalsToday: 0 } })).reasonCode).toBe(
      "TENURE_TOO_SHORT",
    );
  });
  it("refuses when the member weekly cap is reached", () => {
    expect(prefilter(input({ member: { approxAccountAgeDays: 400, tenureDays: 30, paidThisWeekUsdc: 20, publicRefusalsToday: 0 } })).reasonCode).toBe(
      "MEMBER_CAP",
    );
  });
  it("refuses when the room daily cap is reached", () => {
    expect(prefilter(input({ room: { paidTodayUsdc: 50, remainingAllowanceUsdc: 100 } })).reasonCode).toBe("ROOM_DAILY_CAP");
  });
  it("refuses when the room weekly allowance is exhausted", () => {
    expect(prefilter(input({ room: { paidTodayUsdc: 0, remainingAllowanceUsdc: 0 } })).reasonCode).toBe("ROOM_ALLOWANCE");
  });
});

describe("public reply limit", () => {
  it("blocks a public refusal after the daily limit", () => {
    const r = prefilter(input({ text: "gm", member: { approxAccountAgeDays: 400, tenureDays: 30, paidThisWeekUsdc: 0, publicRefusalsToday: 1 } }));
    expect(r.pass).toBe(false);
    expect(r.canReplyPublicly).toBe(false);
  });
});

describe("hashing + simhash primitives", () => {
  it("contentHash ignores case, urls, and whitespace", () => {
    expect(contentHash("Hello   world")).toBe(contentHash("hello world"));
    expect(contentHash("hello world https://x.com")).toBe(contentHash("hello world"));
  });
  it("identical text has zero Hamming distance; different text has more", () => {
    expect(hammingDistance(simhash(REAL), simhash(REAL))).toBe(0);
    expect(hammingDistance(simhash(REAL), simhash("completely unrelated content about cats"))).toBeGreaterThan(3);
  });
  it("isNearDuplicate respects the threshold", () => {
    expect(isNearDuplicate(simhash(REAL), [simhash(REAL)], 3)).toBe(true);
    expect(isNearDuplicate(simhash(REAL), [], 3)).toBe(false);
  });
});

describe("account age approximation", () => {
  it("is monotonic: a larger id means a younger account", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const older = approxAccountAgeDaysFromUserId(200_000_000n, now);
    const newer = approxAccountAgeDaysFromUserId(1_400_000_000n, now);
    expect(older).toBeGreaterThan(newer);
    expect(newer).toBeGreaterThanOrEqual(0);
  });
});

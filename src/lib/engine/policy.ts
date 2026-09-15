import { type Decision, type MemberFacts, type ModelVerdict, type RoomFacts, type Rules } from "./types";

/**
 * The policy layer. Deterministic. It takes the model's verdict and the facts and makes the final call.
 * It normalizes the model's proposal into the owner's category range, including raising a
 * below-minimum proposal to the category floor. Caps may then lower or refuse it, and the
 * chain enforces the real spending limit on top of this.
 */

export const CONFIDENCE_FLOOR = 0.55;

function refuse(reasonCode: Decision["reasonCode"], reasonText: string, categoryKey: string | null, notes: string[]): Decision {
  return { pay: false, amountUsdc: 0, reasonCode, reasonText, categoryKey, hold: false, notes };
}

export function decide(
  verdict: ModelVerdict,
  rules: Rules,
  member: MemberFacts,
  room: RoomFacts,
): Decision {
  const notes: string[] = [];

  // 1. Model said not payable.
  if (verdict.categoryKey === null) {
    return refuse(verdict.reasonCode, verdict.reasonText, null, ["model: not payable work"]);
  }

  // 2. Category must exist in the current rules.
  const category = rules.categories.find((c) => c.key === verdict.categoryKey);
  if (!category) {
    return refuse("NO_SUBSTANCE", "did not match a paid category", null, [`model returned unknown category ${verdict.categoryKey}`]);
  }

  // 3. Confidence floor.
  if (verdict.confidence < CONFIDENCE_FLOOR) {
    return refuse("NO_SUBSTANCE", verdict.reasonText, category.key, [`confidence ${verdict.confidence} below floor ${CONFIDENCE_FLOOR}`]);
  }

  // 4. Sybil floors. These are refusals, not holds.
  if (member.approxAccountAgeDays < rules.minAccountAgeDays) {
    return refuse("ACCOUNT_TOO_NEW", verdict.reasonText, category.key, [`account ${member.approxAccountAgeDays}d < min ${rules.minAccountAgeDays}d`]);
  }
  if (member.tenureDays < rules.minTenureDays) {
    return refuse("TENURE_TOO_SHORT", verdict.reasonText, category.key, [`tenure ${member.tenureDays}d < min ${rules.minTenureDays}d`]);
  }

  // 5. Normalize the amount into the owner-defined category range. A proposal below the
  // category minimum is raised to the owner's floor; one above the maximum is lowered.
  let amount = verdict.proposedAmountUsdc;
  if (amount > category.maxUsdc) {
    notes.push(`clamped ${amount} down to category max ${category.maxUsdc}`);
    amount = category.maxUsdc;
  }
  if (amount < category.minUsdc) {
    notes.push(`raised proposal ${amount} to category min ${category.minUsdc}`);
    amount = category.minUsdc; // min is the owner's floor for a paid item, not the model raising itself
  }

  // 6. Caps. Each returns a refusal with the specific reason. Checked cheapest-truth first.
  const memberRemaining = rules.memberWeeklyCapUsdc - member.paidThisWeekUsdc;
  if (memberRemaining <= 0) {
    return refuse("MEMBER_CAP", verdict.reasonText, category.key, [`member paid ${member.paidThisWeekUsdc} >= cap ${rules.memberWeeklyCapUsdc}`]);
  }
  const roomDailyRemaining = rules.roomDailyCapUsdc - room.paidTodayUsdc;
  if (roomDailyRemaining <= 0) {
    return refuse("ROOM_DAILY_CAP", verdict.reasonText, category.key, [`room paid today ${room.paidTodayUsdc} >= daily cap ${rules.roomDailyCapUsdc}`]);
  }
  if (room.remainingAllowanceUsdc <= 0) {
    return refuse("ROOM_ALLOWANCE", verdict.reasonText, category.key, [`room weekly allowance exhausted`]);
  }

  // After normalization, a payout may be lowered to fit the tightest remaining cap, but never below the category min.
  const ceiling = Math.min(memberRemaining, roomDailyRemaining, room.remainingAllowanceUsdc);
  if (amount > ceiling) {
    if (ceiling < category.minUsdc) {
      // Not enough headroom to pay even the floor for this category: refuse on the binding cap.
      const binding =
        ceiling === memberRemaining ? "MEMBER_CAP" : ceiling === roomDailyRemaining ? "ROOM_DAILY_CAP" : "ROOM_ALLOWANCE";
      return refuse(binding, verdict.reasonText, category.key, [`ceiling ${ceiling} below category min ${category.minUsdc}`]);
    }
    notes.push(`lowered ${amount} to remaining ceiling ${ceiling}`);
    amount = ceiling;
  }

  // 7. Wallet presence. Approved work with no wallet becomes a hold, not a payout.
  if (!member.hasLinkedWallet) {
    return {
      pay: false,
      amountUsdc: amount,
      reasonCode: "NO_WALLET",
      reasonText: verdict.reasonText,
      categoryKey: category.key,
      hold: true,
      notes: [...notes, "approved but no linked wallet: 72h hold"],
    };
  }

  // 8. Pay.
  return {
    pay: true,
    amountUsdc: Number(amount.toFixed(2)),
    reasonCode: verdict.reasonCode,
    reasonText: verdict.reasonText,
    categoryKey: category.key,
    hold: false,
    notes,
  };
}

import type { GenerateResult } from "@/lib/llm";
import { classify } from "./classify";
import { decide } from "./policy";
import { prefilter } from "./prefilter";
import { REASON, type Decision, type ModelVerdict, type Rules } from "./types";

/**
 * The full scoring pipeline: pre-filter (cheap, model-free) -> classify (model) -> policy
 * (deterministic). Pure and side-effect free so it can be unit-tested with a stubbed
 * classifier and reused by the DB-backed runner and the webhook. It never sees or returns
 * a recipient; recipients come only from the Wallet table.
 */

export interface EngineMember {
  approxAccountAgeDays: number;
  tenureDays: number;
  paidThisWeekUsdc: number;
  publicRefusalsToday: number;
  hasLinkedWallet: boolean;
}

export interface EngineRoom {
  paidTodayUsdc: number;
  remainingAllowanceUsdc: number;
}

export interface EngineInput {
  text: string;
  rules: Rules;
  questions: string[];
  member: EngineMember;
  room: EngineRoom;
  priorSimhashes?: bigint[];
  priorContentHashes?: string[];
}

export interface EngineResult {
  stage: "prefilter" | "model";
  decision: Decision;
  verdict: ModelVerdict | null;
  provider: string | null;
  latencyMs: number;
  contentHash: string;
  simhash: bigint;
  canReplyPublicly: boolean;
}

export type ClassifyFn = (
  text: string,
  rules: Rules,
  questions: string[],
) => Promise<GenerateResult<ModelVerdict>>;

const defaultClassify: ClassifyFn = (text, rules, questions) => classify(text, rules, questions);

export async function scoreContribution(
  input: EngineInput,
  deps: { classify?: ClassifyFn } = {},
): Promise<EngineResult> {
  const pre = prefilter({
    text: input.text,
    member: {
      approxAccountAgeDays: input.member.approxAccountAgeDays,
      tenureDays: input.member.tenureDays,
      paidThisWeekUsdc: input.member.paidThisWeekUsdc,
      publicRefusalsToday: input.member.publicRefusalsToday,
    },
    rules: {
      minAccountAgeDays: input.rules.minAccountAgeDays,
      minTenureDays: input.rules.minTenureDays,
      memberWeeklyCapUsdc: input.rules.memberWeeklyCapUsdc,
      roomDailyCapUsdc: input.rules.roomDailyCapUsdc,
    },
    room: input.room,
    priorSimhashes: input.priorSimhashes,
    priorContentHashes: input.priorContentHashes,
  });

  if (!pre.pass) {
    const reasonCode = pre.reasonCode ?? "NO_SUBSTANCE";
    return {
      stage: "prefilter",
      decision: {
        pay: false,
        amountUsdc: 0,
        reasonCode,
        reasonText: REASON[reasonCode],
        categoryKey: null,
        hold: false,
        notes: [`prefilter: ${reasonCode}`],
      },
      verdict: null,
      provider: null,
      latencyMs: 0,
      contentHash: pre.contentHash,
      simhash: pre.simhash,
      canReplyPublicly: pre.canReplyPublicly,
    };
  }

  const classifyFn = deps.classify ?? defaultClassify;
  const res = await classifyFn(input.text, input.rules, input.questions);
  const decision = decide(res.data, input.rules, {
    approxAccountAgeDays: input.member.approxAccountAgeDays,
    tenureDays: input.member.tenureDays,
    paidThisWeekUsdc: input.member.paidThisWeekUsdc,
    hasLinkedWallet: input.member.hasLinkedWallet,
  }, {
    remainingAllowanceUsdc: input.room.remainingAllowanceUsdc,
    paidTodayUsdc: input.room.paidTodayUsdc,
  });

  return {
    stage: "model",
    decision,
    verdict: res.data,
    provider: res.provider,
    latencyMs: res.durationMs,
    contentHash: pre.contentHash,
    simhash: pre.simhash,
    canReplyPublicly: pre.canReplyPublicly,
  };
}

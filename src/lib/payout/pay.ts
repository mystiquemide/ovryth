import { encodeFunctionData, type Address, type Hex } from "viem";
import { OVRYTH_PAYER_ABI, type SpendPermission } from "@/lib/chain";

/** SpendPermission fields in the tuple order the payer/manager expect. */
export function toPayArgs(p: SpendPermission) {
  return {
    account: p.account,
    spender: p.spender,
    token: p.token,
    allowance: p.allowance,
    period: p.period,
    start: p.start,
    end: p.end,
    salt: p.salt,
    extraData: p.extraData,
  };
}

/** Calldata for OvrythPayer.pay(permission, approveSig, needsApprove, amount, recipient). */
export function encodePay(
  p: SpendPermission,
  approveSig: Hex,
  needsApprove: boolean,
  amountMicroUsdc: bigint,
  recipient: Address,
): Hex {
  return encodeFunctionData({
    abi: OVRYTH_PAYER_ABI,
    functionName: "pay",
    args: [toPayArgs(p), approveSig, needsApprove, amountMicroUsdc, recipient],
  });
}

/** Minimal ABIs for the contracts Ovryth touches on Base. */

export const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

/** SpendPermission tuple shape shared by the manager and the payer. */
export const SPEND_PERMISSION_COMPONENTS = [
  { name: "account", type: "address" },
  { name: "spender", type: "address" },
  { name: "token", type: "address" },
  { name: "allowance", type: "uint160" },
  { name: "period", type: "uint48" },
  { name: "start", type: "uint48" },
  { name: "end", type: "uint48" },
  { name: "salt", type: "uint256" },
  { name: "extraData", type: "bytes" },
] as const;

const SP_TUPLE = { name: "spendPermission", type: "tuple", components: SPEND_PERMISSION_COMPONENTS } as const;

export const SPEND_PERMISSION_MANAGER_ABI = [
  { name: "getHash", type: "function", stateMutability: "view", inputs: [SP_TUPLE], outputs: [{ type: "bytes32" }] },
  { name: "isApproved", type: "function", stateMutability: "view", inputs: [SP_TUPLE], outputs: [{ type: "bool" }] },
  { name: "isRevoked", type: "function", stateMutability: "view", inputs: [SP_TUPLE], outputs: [{ type: "bool" }] },
  {
    name: "getCurrentPeriod",
    type: "function",
    stateMutability: "view",
    inputs: [SP_TUPLE],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "start", type: "uint48" },
          { name: "end", type: "uint48" },
          { name: "spend", type: "uint160" },
        ],
      },
    ],
  },
  { name: "approveWithSignature", type: "function", stateMutability: "nonpayable", inputs: [SP_TUPLE, { name: "signature", type: "bytes" }], outputs: [{ type: "bool" }] },
  { name: "spend", type: "function", stateMutability: "nonpayable", inputs: [SP_TUPLE, { name: "value", type: "uint160" }], outputs: [] },
] as const;

export const OVRYTH_PAYER_ABI = [
  { name: "manager", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "operator", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    name: "pay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      SP_TUPLE,
      { name: "approveSig", type: "bytes" },
      { name: "needsApprove", type: "bool" },
      { name: "amount", type: "uint160" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "Paid",
    type: "event",
    inputs: [
      { name: "permissionHash", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint160", indexed: false },
    ],
  },
] as const;

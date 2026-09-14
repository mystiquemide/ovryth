/**
 * Create (and, if gas is available, deploy) a Coinbase Smart Wallet (Base Account)
 * owned by a dedicated EOA we control, so the spend-permission spike can run headless.
 *
 *   npm run base:create
 *
 * Idempotent:
 *   - If DEMO_OWNER_EOA_PRIVATE_KEY is empty, generates one and writes it + the
 *     computed smart-wallet address into .env.local (keys never printed).
 *   - Computes the counterfactual account address (no gas needed).
 *   - If the account is already deployed, reports and exits.
 *   - If not deployed and the operator EOA has gas, deploys it via the factory.
 *   - If not deployed and the operator has no gas, prints exactly what to fund.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createPublicClient, createWalletClient, http, getAddress, formatEther, formatUnits, parseEther, encodeFunctionData, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";
import { readFileSync, writeFileSync } from "node:fs";

const RPC = must("BASE_RPC_URL");
const USDC = getAddress(must("USDC_ADDRESS"));
const MANAGER = getAddress(must("SPEND_PERMISSION_MANAGER"));
const OPERATOR_PK = must("OVRYTH_OPERATOR_PRIVATE_KEY") as Hex;
const ENV_PATH = new URL("../.env.local", import.meta.url).pathname;

const operator = privateKeyToAccount(OPERATOR_PK);
const publicClient = createPublicClient({ chain: base, transport: http(RPC) });
const walletClient = createWalletClient({ account: operator, chain: base, transport: http(RPC) });

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// Coinbase Smart Wallet owner management (MultiOwnable).
const OWNABLE_ABI = [
  { name: "isOwnerAddress", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "addOwnerAddress", type: "function", stateMutability: "nonpayable", inputs: [{ name: "owner", type: "address" }], outputs: [] },
] as const;

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function setEnv(key: string, value: string) {
  let env = readFileSync(ENV_PATH, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  env = re.test(env) ? env.replace(re, `${key}=${value}`) : env + `\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, env);
}

async function main() {
  // 1. Owner EOA (signer). Generate + persist if absent.
  let ownerPk = process.env.DEMO_OWNER_EOA_PRIVATE_KEY as Hex | undefined;
  if (!ownerPk) {
    ownerPk = generatePrivateKey();
    setEnv("DEMO_OWNER_EOA_PRIVATE_KEY", ownerPk);
    console.log("Generated demo owner EOA (key written to .env.local, not printed).");
  }
  const ownerEoa = privateKeyToAccount(ownerPk);

  // 2. Compute the Coinbase Smart Wallet address (counterfactual, no gas).
  const smartAccount = await toCoinbaseSmartAccount({
    client: publicClient,
    owners: [ownerEoa],
    version: "1.1",
  });
  const account = getAddress(smartAccount.address);
  setEnv("DEMO_OWNER_ADDRESS", account);

  console.log("\nCoinbase Base Account (demo project owner)");
  console.log("  owner EOA (signer):", ownerEoa.address);
  console.log("  account address:   ", account, "<- fund this with USDC");
  console.log("  operator (spender):", operator.address, "<- fund this with gas ETH");

  const [deployedCode, operatorEth, accountUsdc] = await Promise.all([
    publicClient.getCode({ address: account }),
    publicClient.getBalance({ address: operator.address }),
    publicClient.readContract({ address: USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account] }),
  ]);
  const isDeployed = !!deployedCode && deployedCode !== "0x";
  console.log("\nState");
  console.log("  account deployed:", isDeployed);
  console.log("  account USDC:    ", formatUnits(accountUsdc, 6));
  console.log("  operator ETH:    ", formatEther(operatorEth));

  if (!isDeployed) {
    if (operatorEth === BigInt(0)) {
      console.log("\nNot deployed yet and operator has no gas. To finish:");
      console.log(`  1. Send ~0.01 ETH (Base) to operator ${operator.address}`);
      console.log(`  2. Send ~5 USDC (Base) to account  ${account}`);
      console.log("  3. Re-run `npm run base:create` to deploy, then `SEND=1 npm run spike:spend`.");
      return;
    }
    // 3. Deploy via factory args from the operator.
    const { factory, factoryData } = await smartAccount.getFactoryArgs();
    if (!factory || !factoryData) throw new Error("No factory args returned; account may already be deployed.");
    console.log("\nDeploying account via factory", factory, "…");
    const hash = await walletClient.sendTransaction({ to: factory, data: factoryData });
    console.log("  tx:", hash);
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("  status:", rcpt.status, "block:", rcpt.blockNumber);
    if (rcpt.status !== "success") throw new Error("Deployment reverted.");
    console.log("  deployed.");
  }

  // 4. Ensure the SpendPermissionManager is an owner (required for spend() to move funds).
  await ensureManagerOwner(account, ownerEoa);

  console.log("\nReady for `SEND=1 npm run spike:spend` once the account holds USDC.");
}

/**
 * The SpendPermissionManager singleton must be an owner of the Coinbase Smart Wallet,
 * otherwise its spend() -> account.execute reverts (Coinbase's design). Coinbase's own
 * wallet adds it during the first approval; headless we add it via an owner (the owner EOA).
 */
async function ensureManagerOwner(account: `0x${string}`, ownerEoa: ReturnType<typeof privateKeyToAccount>) {
  const already = await publicClient.readContract({ address: account, abi: OWNABLE_ABI, functionName: "isOwnerAddress", args: [MANAGER] });
  console.log("\nManager ownership");
  console.log("  SpendPermissionManager is owner:", already);
  if (already) return;

  // The owner EOA needs a little gas to submit addOwnerAddress; top it up from the operator.
  const ownerBal = await publicClient.getBalance({ address: ownerEoa.address });
  const minOwnerGas = parseEther("0.00001");
  if (ownerBal < minOwnerGas) {
    const topUp = parseEther("0.00003");
    console.log(`  funding owner EOA ${ownerEoa.address} with ${formatEther(topUp)} ETH for gas…`);
    const fundHash = await walletClient.sendTransaction({ to: ownerEoa.address, value: topUp });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
  }

  const ownerWallet = createWalletClient({ account: ownerEoa, chain: base, transport: http(RPC) });
  console.log(`  adding manager ${MANAGER} as owner…`);
  const hash = await ownerWallet.sendTransaction({
    to: account,
    data: encodeFunctionData({ abi: OWNABLE_ABI, functionName: "addOwnerAddress", args: [MANAGER] }),
  });
  console.log("  tx:", hash);
  const rcpt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("  status:", rcpt.status, "block:", rcpt.blockNumber);
  if (rcpt.status !== "success") throw new Error("addOwnerAddress reverted.");
  // Read-back can hit a lagging RPC node right after the block; retry briefly.
  let nowOwner = false;
  for (let i = 0; i < 6 && !nowOwner; i++) {
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    nowOwner = (await publicClient.readContract({ address: account, abi: OWNABLE_ABI, functionName: "isOwnerAddress", args: [MANAGER] })) as boolean;
  }
  if (!nowOwner) throw new Error("Manager still not an owner after addOwnerAddress (tx succeeded; check RPC).");
  console.log("  manager is now an owner.");
}

main().catch((e) => {
  console.error("\ncreate-base-account error:", e instanceof Error ? e.message : e);
  process.exit(1);
});

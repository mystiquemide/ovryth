/**
 * npm run rooms:smoke
 * End-to-end check of the Rooms API against a running dev server (npm run dev on :3400):
 * builds a permission naming the payer as spender for the demo Base Account, signs the
 * owner authorization with the demo Coinbase Smart Wallet, POSTs /api/rooms, then GETs it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createPublicClient, http, getAddress, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { toCoinbaseSmartAccount } from "viem/account-abstraction";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3400";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const PAYER = getAddress(process.env.NEXT_PUBLIC_PAYER_ADDRESS!);
const owner = getAddress(process.env.DEMO_OWNER_ADDRESS!);
const ownerEoa = privateKeyToAccount(process.env.DEMO_OWNER_EOA_PRIVATE_KEY! as Hex);

const publicClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });

const OWNER_MSG = (action: string, resource: string, issuedAt: string) =>
  ["Ovryth room authorization", `action: ${action}`, `resource: ${resource}`, `issuedAt: ${issuedAt}`].join("\n");

// Manager EIP-712 (to compute the permission hash the owner authorizes for create).
const SP_TYPES = {
  SpendPermission: [
    { name: "account", type: "address" }, { name: "spender", type: "address" }, { name: "token", type: "address" },
    { name: "allowance", type: "uint160" }, { name: "period", type: "uint48" }, { name: "start", type: "uint48" },
    { name: "end", type: "uint48" }, { name: "salt", type: "uint256" }, { name: "extraData", type: "bytes" },
  ],
} as const;

async function main() {
  const smartAccount = await toCoinbaseSmartAccount({ client: publicClient, owners: [ownerEoa], address: owner, version: "1.1" });

  const start = Math.floor(Date.now() / 1000) - 600;
  const salt = BigInt("0x" + Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex"));
  const permission = {
    account: owner,
    spender: PAYER,
    token: getAddress(USDC),
    allowance: (5_000_000n).toString(),
    period: 7 * 86400,
    start,
    end: 281474976710655,
    salt: salt.toString(),
    extraData: "0x",
  };

  const { hashTypedData } = await import("viem");
  const permissionHash = hashTypedData({
    domain: { name: "Spend Permission Manager", version: "1", chainId: 8453, verifyingContract: getAddress("0xf85210B21cC50302F477BA56686d2019dC9b67Ad") },
    types: SP_TYPES,
    primaryType: "SpendPermission",
    message: { ...permission, allowance: BigInt(permission.allowance), salt, extraData: "0x" as Hex },
  });

  const issuedAt = new Date().toISOString();
  const ownerSignature = await smartAccount.signMessage({ message: OWNER_MSG("create-room", permissionHash, issuedAt) });

  const body = {
    name: "Ovryth Smoke Room",
    tokenSymbol: "SMOKE",
    permission: { signature: "0x", chainId: 8453, permission },
    ownerSignature,
    issuedAt,
  };

  console.log("POST", `${BASE_URL}/api/rooms`);
  const postRes = await fetch(`${BASE_URL}/api/rooms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const postJson = await postRes.json();
  console.log("  status", postRes.status, postJson);
  if (!postRes.ok) throw new Error("create failed");

  const slug = postJson.slug as string;
  console.log("GET", `${BASE_URL}/api/rooms/${slug}`);
  const getRes = await fetch(`${BASE_URL}/api/rooms/${slug}`);
  const getJson = await getRes.json();
  console.log("  status", getRes.status);
  console.log("  room:", getJson.room);
  console.log("  permission:", getJson.permission);
  console.log("  permissionStatus:", getJson.permissionStatus, "statusError:", getJson.statusError);
  console.log("  rulesVersion:", getJson.rulesVersion?.version, "categories:", (getJson.rulesVersion?.categories ?? []).length);
  console.log(getRes.ok ? "\nrooms:smoke OK" : "\nrooms:smoke FAILED");
  if (!getRes.ok) process.exit(1);
}

main().catch((e) => { console.error("rooms:smoke error:", e instanceof Error ? e.message : e); process.exit(1); });

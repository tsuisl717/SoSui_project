import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MOVE_DIR = resolve(__dirname, "..");
export const REPO_ROOT = resolve(MOVE_DIR, "..");
export const DEPLOY_RECORD = join(MOVE_DIR, ".deploy.json");

type Network = "mainnet" | "testnet" | "devnet" | "localnet";

export interface DeployRecord {
  digest: string;
  network: string;
  packageId: string;
  configId: string;
  adminCapId: string;
  treasury: string;
}

export function loadEnv(): NodeJS.ProcessEnv {
  dotenvConfig({ path: join(MOVE_DIR, ".env") });
  return process.env;
}

export function getNetwork(env: NodeJS.ProcessEnv): Network {
  const n = (env.NETWORK || "testnet").trim() as Network;
  if (!["mainnet", "testnet", "devnet", "localnet"].includes(n)) {
    throw new Error(`bad NETWORK: ${n}`);
  }
  return n;
}

export function getRpcUrl(env: NodeJS.ProcessEnv): string {
  if (env.RPC_URL) return env.RPC_URL;
  const network = getNetwork(env);
  if (network === "localnet") return "http://127.0.0.1:9000";
  return getFullnodeUrl(network);
}

export function getClient(env: NodeJS.ProcessEnv): SuiClient {
  return new SuiClient({ url: getRpcUrl(env) });
}

function keypairFromBech32(raw: string): Ed25519Keypair {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("suiprivkey1")) {
    throw new Error(
      'private key must be Sui bech32 format starting with "suiprivkey1". ' +
        "Run `sui keytool export <address>` to get one.",
    );
  }
  const { schema, secretKey } = decodeSuiPrivateKey(trimmed);
  if (schema !== "ED25519") {
    throw new Error(`only ED25519 supported, got ${schema}`);
  }
  return Ed25519Keypair.fromSecretKey(secretKey);
}

export function loadDeployerKeypair(env: NodeJS.ProcessEnv): Ed25519Keypair {
  if (!env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is empty in .env");
  }
  return keypairFromBech32(env.DEPLOYER_PRIVATE_KEY);
}

export function loadTreasuryKeypair(env: NodeJS.ProcessEnv): Ed25519Keypair {
  if (env.TREASURY_PRIVATE_KEY) {
    return keypairFromBech32(env.TREASURY_PRIVATE_KEY);
  }
  return loadDeployerKeypair(env);
}

export function loadDeploy(): DeployRecord {
  if (!existsSync(DEPLOY_RECORD)) {
    throw new Error(`${DEPLOY_RECORD} not found — run \`npm run publish\` first.`);
  }
  return JSON.parse(readFileSync(DEPLOY_RECORD, "utf8")) as DeployRecord;
}

export function upsertEnv(content: string, key: string, val: string): string {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, `${key}=${val}`);
  const sep = content === "" || content.endsWith("\n") ? "" : "\n";
  return `${content}${sep}${key}=${val}\n`;
}

export function mistToSui(mist: bigint | string | number): string {
  const n = typeof mist === "bigint" ? mist : BigInt(mist.toString());
  return (Number(n) / 1e9).toFixed(4);
}

export function suiToMist(sui: number | string): bigint {
  return BigInt(Math.round(Number(sui) * 1e9));
}

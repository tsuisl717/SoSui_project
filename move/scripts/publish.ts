// Build + publish the Move package, then write the resulting IDs to:
//   - move/.deploy.json     (full record, used by admin scripts)
//   - ../.env.local         (frontend Next.js env)
//
// The Move package's `init()` runs automatically on publish: mints AdminCap
// to the publisher, shares Config, sets treasury = publisher.
//
// Usage:  npm run publish
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiObjectChange } from "@mysten/sui/client";
import {
  loadEnv,
  loadDeployerKeypair,
  getClient,
  getRpcUrl,
  getNetwork,
  upsertEnv,
  MOVE_DIR,
  REPO_ROOT,
  DEPLOY_RECORD,
  type DeployRecord,
} from "./_helpers.js";

async function main() {
  const env = loadEnv();
  const client = getClient(env);
  const deployer = loadDeployerKeypair(env);
  const sender = deployer.toSuiAddress();
  const network = getNetwork(env);

  console.log("rpc:     ", getRpcUrl(env));
  console.log("network: ", network);
  console.log("deployer:", sender);

  // 1) Compile package + dump bytecode (uses Sui CLI under the hood).
  console.log("\n· building move package…");
  const buildOut = execSync(
    `sui move build --dump-bytecode-as-base64 --path "${MOVE_DIR}"`,
    { encoding: "utf8" },
  );
  const { modules, dependencies } = JSON.parse(buildOut) as {
    modules: string[];
    dependencies: string[];
  };

  // 2) Build publish tx.
  const tx = new Transaction();
  const [upgradeCap] = tx.publish({ modules, dependencies });
  tx.transferObjects([upgradeCap], sender);

  // 3) Execute.
  console.log("· publishing…");
  const res = await client.signAndExecuteTransaction({
    signer: deployer,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });

  if (res.effects?.status?.status !== "success") {
    throw new Error(
      `publish failed: ${res.effects?.status?.error ?? "unknown"}`,
    );
  }

  // 4) Parse object changes to find packageId, Config, AdminCap.
  const changes: SuiObjectChange[] = res.objectChanges ?? [];

  const published = changes.find((c) => c.type === "published");
  if (!published || published.type !== "published") {
    throw new Error("no published package in object changes");
  }
  const packageId = published.packageId;

  const findCreated = (typeSuffix: string) =>
    changes.find(
      (c) => c.type === "created" && c.objectType.endsWith(typeSuffix),
    );

  const configChange = findCreated("::ephemeral_chat::Config");
  const adminCapChange = findCreated("::ephemeral_chat::AdminCap");
  if (
    !configChange ||
    configChange.type !== "created" ||
    !adminCapChange ||
    adminCapChange.type !== "created"
  ) {
    throw new Error("Config or AdminCap not found in object changes");
  }
  const configId = configChange.objectId;
  const adminCapId = adminCapChange.objectId;
  const treasury = sender; // init() sets treasury = publisher

  console.log("\n✓ publish OK");
  console.log("  digest:    ", res.digest);
  console.log("  package:   ", packageId);
  console.log("  config:    ", configId);
  console.log("  adminCap:  ", adminCapId);
  console.log("  treasury:  ", treasury);

  // 5) Persist deploy record (consumed by admin scripts).
  const record: DeployRecord = {
    digest: res.digest,
    network,
    packageId,
    configId,
    adminCapId,
    treasury,
  };
  writeFileSync(DEPLOY_RECORD, JSON.stringify(record, null, 2) + "\n");
  console.log(`\n✓ ${DEPLOY_RECORD}`);

  // 6) Write frontend env at repo root.
  const feEnv = join(REPO_ROOT, ".env.local");
  let fe = existsSync(feEnv) ? readFileSync(feEnv, "utf8") : "";
  const updates: Record<string, string> = {
    NEXT_PUBLIC_SUI_NETWORK: network,
    NEXT_PUBLIC_SUI_RPC: getRpcUrl(env),
    NEXT_PUBLIC_SUI_PACKAGE_ID: packageId,
    NEXT_PUBLIC_SUI_CONFIG_ID: configId,
    NEXT_PUBLIC_SUI_TREASURY: treasury,
  };
  for (const [k, v] of Object.entries(updates)) fe = upsertEnv(fe, k, v);
  writeFileSync(feEnv, fe);
  console.log(`\n✓ .env.local updated:`);
  for (const [k, v] of Object.entries(updates)) console.log(`  ${k}=${v}`);

  console.log(
    "\n✓ deployment finalized.",
    "\n  defaults: public_fee=0 SUI, private_fee=0.01 SUI, ttl 3d/7d, cap 1000 msgs",
  );
}

main().catch((e) => {
  console.error("\n✗ publish failed:", e);
  process.exit(1);
});

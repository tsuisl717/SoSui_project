// Rotate the treasury address stored in the on-chain Config. Admin-only.
//
// Usage:
//   npm run update-treasury -- --treasury 0x<address>
//   or set NEW_TREASURY=0x<address> in .env
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import {
  loadEnv,
  loadDeployerKeypair,
  getClient,
  loadDeploy,
  upsertEnv,
  REPO_ROOT,
  DEPLOY_RECORD,
} from "./_helpers.js";

function parseArg(): string | null {
  const i = process.argv.indexOf("--treasury");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

async function main() {
  const env = loadEnv();
  const target = parseArg() || env.NEW_TREASURY;
  if (!target) {
    console.error(
      "✗ usage: npm run update-treasury -- --treasury 0x<address>",
    );
    console.error("  or set NEW_TREASURY=0x<address> in .env");
    process.exit(1);
  }
  if (!target.startsWith("0x")) {
    console.error(`✗ treasury address must start with 0x: ${target}`);
    process.exit(1);
  }

  const client = getClient(env);
  const admin = loadDeployerKeypair(env);
  const deploy = loadDeploy();

  console.log("package:     ", deploy.packageId);
  console.log("admin:       ", admin.toSuiAddress());
  console.log("config:      ", deploy.configId);
  console.log("admin cap:   ", deploy.adminCapId);
  console.log("old treasury:", deploy.treasury);
  console.log("new treasury:", target);

  const tx = new Transaction();
  tx.moveCall({
    target: `${deploy.packageId}::ephemeral_chat::update_treasury`,
    arguments: [
      tx.object(deploy.adminCapId),
      tx.object(deploy.configId),
      tx.pure.address(target),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: admin,
    transaction: tx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`tx failed: ${res.effects?.status?.error}`);
  }
  console.log("\n✓ update_treasury →", res.digest);

  // Update local records.
  deploy.treasury = target;
  writeFileSync(DEPLOY_RECORD, JSON.stringify(deploy, null, 2) + "\n");

  const feEnv = join(REPO_ROOT, ".env.local");
  if (existsSync(feEnv)) {
    let fe = readFileSync(feEnv, "utf8");
    fe = upsertEnv(fe, "NEXT_PUBLIC_SUI_TREASURY", target);
    writeFileSync(feEnv, fe);
    console.log(`✓ .env.local: NEXT_PUBLIC_SUI_TREASURY=${target}`);
  }
}

main().catch((e) => {
  console.error("✗ update-treasury failed:", e);
  process.exit(1);
});

// Change public_fee and private_fee on the on-chain Config. Admin-only.
// Fees are passed in SUI on the CLI and converted to MIST.
//
// Usage:
//   npm run update-fees -- --public 0 --private 0.01
import { Transaction } from "@mysten/sui/transactions";
import {
  loadEnv,
  loadDeployerKeypair,
  getClient,
  loadDeploy,
  suiToMist,
} from "./_helpers.js";

function parseArg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

async function main() {
  const publicSui = parseArg("public");
  const privateSui = parseArg("private");
  if (publicSui === null || privateSui === null) {
    console.error(
      "✗ usage: npm run update-fees -- --public <sui> --private <sui>",
    );
    console.error("  example: npm run update-fees -- --public 0 --private 0.01");
    process.exit(1);
  }
  const publicMist = suiToMist(publicSui);
  const privateMist = suiToMist(privateSui);

  const env = loadEnv();
  const client = getClient(env);
  const admin = loadDeployerKeypair(env);
  const deploy = loadDeploy();

  console.log("package:     ", deploy.packageId);
  console.log("public fee:  ", publicSui, `SUI (${publicMist} MIST)`);
  console.log("private fee: ", privateSui, `SUI (${privateMist} MIST)`);

  const tx = new Transaction();
  tx.moveCall({
    target: `${deploy.packageId}::ephemeral_chat::update_fees`,
    arguments: [
      tx.object(deploy.adminCapId),
      tx.object(deploy.configId),
      tx.pure.u64(publicMist),
      tx.pure.u64(privateMist),
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
  console.log("\n✓ update_fees →", res.digest);
}

main().catch((e) => {
  console.error("✗ update-fees failed:", e);
  process.exit(1);
});

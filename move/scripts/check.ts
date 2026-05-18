// Reports deployer address + SUI balance on the chosen network.
// Run this before publish to confirm funding.
//
// Usage:  npm run check
import {
  loadEnv,
  loadDeployerKeypair,
  getClient,
  getRpcUrl,
  getNetwork,
  mistToSui,
} from "./_helpers.js";

const MIN_SUI_FOR_PUBLISH = 2; // rough — Move package publish needs ~1-2 SUI for storage + gas

async function main() {
  const env = loadEnv();
  const kp = loadDeployerKeypair(env);
  const client = getClient(env);
  const addr = kp.toSuiAddress();
  const network = getNetwork(env);

  console.log("rpc:    ", getRpcUrl(env));
  console.log("network:", network);
  console.log("wallet: ", addr);

  const { totalBalance } = await client.getBalance({ owner: addr });
  const balance = BigInt(totalBalance);
  console.log(`balance: ${mistToSui(balance)} SUI`);

  if (balance < BigInt(MIN_SUI_FOR_PUBLISH) * 1_000_000_000n) {
    console.log(
      `\n⚠ low balance — you need ~${MIN_SUI_FOR_PUBLISH}+ SUI to publish.`,
    );
    if (network === "testnet" || network === "devnet") {
      console.log(`  request faucet: sui client faucet --address ${addr}`);
    }
  } else {
    console.log("\n✓ wallet has enough SUI to publish.");
  }
}

main().catch((e) => {
  console.error("✗ check failed:", e);
  process.exit(1);
});

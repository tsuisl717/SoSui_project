// Withdraw SUI from the treasury wallet.
//
// SUI fees go straight to the treasury address (the contract doesn't custody
// them in a PDA), so withdrawing is just a regular Coin<SUI> transfer signed
// by the treasury owner.
//
// Usage:
//   npm run withdraw -- <destination_address> <amount_sui | all>
// Examples:
//   npm run withdraw -- 0x7abc... 0.5     # send 0.5 SUI
//   npm run withdraw -- 0x7abc... all     # drain (leaves 0.01 SUI for gas)
//
// Auth: signs with TREASURY_PRIVATE_KEY if set in .env, otherwise falls back
// to DEPLOYER_PRIVATE_KEY (the default treasury after publish).
import { Transaction } from "@mysten/sui/transactions";
import {
  loadEnv,
  getClient,
  getRpcUrl,
  loadDeploy,
  loadTreasuryKeypair,
  mistToSui,
  suiToMist,
} from "./_helpers.js";

const GAS_RESERVE_MIST = 10_000_000n; // 0.01 SUI

async function main() {
  // process.argv: [node, script, --? then "--", dest, amount]
  // npm passes user args after "--"; tsx forwards them. So we look for the
  // last two non-flag tokens.
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const [destArg, amountArg] = args;
  if (!destArg || !amountArg) {
    console.error(
      "usage: npm run withdraw -- <destination_address> <amount_sui | all>",
    );
    process.exit(1);
  }
  if (!destArg.startsWith("0x")) {
    console.error(`✗ destination address must start with 0x: ${destArg}`);
    process.exit(1);
  }

  const env = loadEnv();
  const client = getClient(env);
  const treasury = loadTreasuryKeypair(env);
  const treasuryAddr = treasury.toSuiAddress();
  const deploy = loadDeploy();

  console.log("rpc:               ", getRpcUrl(env));
  console.log("package:           ", deploy.packageId);
  console.log("treasury (config): ", deploy.treasury);
  console.log("treasury signer:   ", treasuryAddr);

  if (deploy.treasury.toLowerCase() !== treasuryAddr.toLowerCase()) {
    console.error(
      `\n✗ on-chain treasury is ${deploy.treasury}\n` +
        `  but loaded signer is ${treasuryAddr}.\n` +
        `  Set TREASURY_PRIVATE_KEY=<suiprivkey1... of ${deploy.treasury}> in .env.`,
    );
    process.exit(1);
  }

  const { totalBalance } = await client.getBalance({ owner: treasuryAddr });
  const balance = BigInt(totalBalance);
  console.log(`balance:           ${mistToSui(balance)} SUI`);

  let amount: bigint;
  if (amountArg.toLowerCase() === "all") {
    amount = balance > GAS_RESERVE_MIST ? balance - GAS_RESERVE_MIST : 0n;
  } else {
    const n = Number(amountArg);
    if (!Number.isFinite(n) || n <= 0) {
      console.error(`✗ bad amount: ${amountArg}`);
      process.exit(1);
    }
    amount = suiToMist(n);
  }

  if (amount === 0n) {
    console.log("nothing to withdraw — treasury is empty.");
    return;
  }
  if (amount >= balance) {
    console.error(
      `✗ amount ${mistToSui(amount)} SUI exceeds spendable balance (need ${mistToSui(GAS_RESERVE_MIST)} SUI reserved for gas)`,
    );
    process.exit(1);
  }

  console.log(`withdraw:          ${mistToSui(amount)} SUI → ${destArg}`);

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amount]);
  tx.transferObjects([coin], destArg);

  const res = await client.signAndExecuteTransaction({
    signer: treasury,
    transaction: tx,
    options: { showEffects: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") {
    throw new Error(`tx failed: ${res.effects?.status?.error}`);
  }
  console.log("\n✓ withdraw →", res.digest);

  const after = await client.getBalance({ owner: treasuryAddr });
  console.log(`balance after:     ${mistToSui(BigInt(after.totalBalance))} SUI`);
}

main().catch((e) => {
  console.error("✗ withdraw failed:", e);
  process.exit(1);
});

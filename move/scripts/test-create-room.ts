// One-off diagnostic: build + send the EXACT same create_room PTB the
// frontend builds, signed with DEPLOYER_PRIVATE_KEY. If this succeeds, the
// contract + PTB are fine and the bug is in the wallet/UI flow.
//
// Usage:  $env:NODE_OPTIONS="--use-system-ca"; npm run test-create
import { Transaction } from "@mysten/sui/transactions";
import {
  loadEnv,
  loadDeployerKeypair,
  getClient,
  loadDeploy,
} from "./_helpers.js";

const SUI_CLOCK_ID = "0x6";
const enc = new TextEncoder();
const bytesOf = (s: string): number[] => Array.from(enc.encode(s));

async function main() {
  const env = loadEnv();
  const client = getClient(env);
  const kp = loadDeployerKeypair(env);
  const deploy = loadDeploy();

  console.log("package:", deploy.packageId);
  console.log("config: ", deploy.configId);
  console.log("sender: ", kp.toSuiAddress());

  const roomId = new Uint8Array(16);
  crypto.getRandomValues(roomId);
  const roomKey = new Uint8Array(32);
  crypto.getRandomValues(roomKey);

  const tx = new Transaction();
  // public room → feeMist = 0
  const [payment] = tx.splitCoins(tx.gas, [0n]);
  tx.moveCall({
    target: `${deploy.packageId}::ephemeral_chat::create_room`,
    arguments: [
      tx.object(deploy.configId),
      tx.pure.vector("u8", Array.from(roomId)),
      tx.pure.vector("u8", bytesOf("test-room")),
      tx.pure.vector("u8", bytesOf("CLI diagnostic")),
      tx.pure.vector("u8", bytesOf("")),
      tx.pure.bool(true),
      tx.pure.vector("u8", Array.from(roomKey)),
      payment,
      tx.object(SUI_CLOCK_ID),
    ],
  });

  console.log("\n· signing + executing…");
  try {
    const res = await client.signAndExecuteTransaction({
      signer: kp,
      transaction: tx,
      options: { showEffects: true, showEvents: true },
    });
    await client.waitForTransaction({ digest: res.digest });

    if (res.effects?.status?.status === "success") {
      console.log("\n✓ create_room OK");
      console.log("  digest:", res.digest);
      const ev = (res.events ?? []).find((e) =>
        e.type.endsWith("::RoomCreated"),
      );
      if (ev) {
        console.log("  room:  ", (ev.parsedJson as any).room);
      }
    } else {
      console.log("\n✗ create_room failed");
      console.log("  status:", res.effects?.status);
    }
  } catch (e: any) {
    console.log("\n✗ exception during execute");
    console.error(e?.message ?? e);
  }
}

main().catch((e) => {
  console.error("✗ test-create failed:", e);
  process.exit(1);
});

# sosui_media — Sui Move package

Ephemeral encrypted chat rooms on Sui. Sui Move port of the original Solana
Anchor program.

## Prereqs

- **Sui CLI** 1.30+ — https://docs.sui.io/guides/developer/getting-started/sui-install
- **Node 20+** with `npm`
- Active Sui env pointing at devnet / testnet / mainnet (`sui client active-env`)
- A funded address (`sui client faucet --address <addr>` on devnet/testnet)

On Windows the Sui CLI works in PowerShell. The TypeScript scripts work
anywhere Node runs.

## One-time setup

```bash
cd move

# 1. install JS deps
npm install

# 2. configure deploy wallet
cp .env.example .env
# Open .env and paste your Sui private key into DEPLOYER_PRIVATE_KEY.
# Get it via:  sui keytool export <your-address>
# It must be in bech32 form, starting with "suiprivkey1...".

# 3. check funding
npm run check
# faucet (devnet/testnet only):  sui client faucet --address <addr>
```

## Publish

```bash
npm run publish
```

That single command:

1. Compiles the package (`sui move build --dump-bytecode-as-base64`)
2. Builds + signs + executes a publish tx
3. Parses object changes to extract the package ID, the shared `Config`,
   and the `AdminCap` (owned by the publisher)
4. Writes `move/.deploy.json` (consumed by admin scripts)
5. Writes `../.env.local` (consumed by the Next.js frontend)

The Move package's `init()` is the on-chain analogue of Anchor's
`initialize` — it runs automatically as part of the publish transaction and
creates `Config` + `AdminCap`. No separate `initialize` step.

## Test

```bash
npm test     # sui move test — Move unit tests under tests/
```

## Admin operations

All admin scripts read `.deploy.json` and sign with `DEPLOYER_PRIVATE_KEY`
(which must own the `AdminCap`).

```bash
# rotate treasury wallet
npm run update-treasury -- --treasury 0x<address>

# change fees (in SUI; converted to MIST internally)
npm run update-fees -- --public 0 --private 0.01

# withdraw SUI from the treasury
npm run withdraw -- 0x<destination> 0.5   # send 0.5 SUI
npm run withdraw -- 0x<destination> all   # drain (leaves 0.01 SUI for gas)
```

If you rotate treasury to a different wallet, set `TREASURY_PRIVATE_KEY` in
`.env` so `withdraw` can sign as the new treasury owner.

## What gets written where

| File | Purpose | Committed? |
| --- | --- | --- |
| `.env` | private keys + network config | **no** — gitignored |
| `.deploy.json` | packageId / configId / adminCapId / treasury | **no** — gitignored, but **back this up** (esp. adminCapId — losing it locks the admin out of admin entries) |
| `../.env.local` | Next.js env (frontend) | no |

## Module surface

| Entry | Auth | What it does |
| --- | --- | --- |
| `init` | — | runs on publish; mints AdminCap, shares Config |
| `update_fees` | `&AdminCap` | set public_fee + private_fee (MIST) |
| `update_ttls` | `&AdminCap` | set public_ttl_ms + private_ttl_ms |
| `update_max_messages` | `&AdminCap` | set per-room message cap |
| `update_treasury` | `&AdminCap` | rotate treasury address |
| `create_room` | sender pays fee | shares a new Room |
| `add_message` | any sender | mutates Room.message_count, emits MessageAdded |
| `close_room` | room.owner | Open → Closed |
| `burn_room_key` | room.owner | Closed → Burned (public rooms only) |

## Mapping from the Anchor version

| Solana / Anchor | Sui Move |
| --- | --- |
| Config PDA (`config_v2` seed) | Shared `Config` object |
| Room PDA (seeds `[ROOM_SEED, room_id]`) | Shared `Room` object (UID + `room_id` field kept for client display) |
| `has_one = admin` Signer check | `AdminCap` capability object |
| `system_program::transfer` (lamports) | `coin::split` + `transfer::public_transfer` of `Coin<SUI>` (auto-refund of change) |
| `Clock::get()?.unix_timestamp` (secs) | `clock::timestamp_ms(&Clock)` (ms) |
| `#[event] RoomCreated` etc. | `event::emit(RoomCreated { .. })` |
| `RoomStatus` / `RoomVisibility` enums | `u8` constants (`STATUS_*`, `VISIBILITY_*`) |
| `[u8; 16]` / `[u8; 32]` fixed arrays | `vector<u8>` with length asserts |

## Upgrade later

The publish tx returns an `UpgradeCap` — `publish.ts` transfers it to the
deployer. Keep that object: it's the authority to upgrade the package.
Upgrades use a separate `sui client upgrade` flow not yet scripted here.

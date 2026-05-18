# sosui_media — Encrypted Programmable Payment Rooms

> **Sui Overflow 2026 submission · Core Track: DeFi & Payments**

Self-destructing private payment channels on Sui — **Stripe meets Signal**. Every tip, subscription, OTC negotiation, and paid DM is wrapped in an encrypted ephemeral room. PTB atomically binds *transfer + encrypted memo + on-chain commit* in one tx. Settle, close, burn — the key is gone and the on-chain ciphertext stays unreadable forever.

**Why Sui:**
- **Asset-as-object** — Rooms, payments, and receipts are typed Move objects with ownership at the type level, not balance entries
- **PTB atomic composition** — Bundle `transfer SUI + commit encrypted memo + update room state` in a single transaction that fails or succeeds as one
- **Move lifecycle policy** — Room close triggers `burn_room_key` on-chain. The key is zeroed by the protocol, not by client honesty.

**Core features:**
- **PTB-native micropayment** — send a message and transfer SUI atomically in one tx, no two-step approve
- **Tipping / paid DMs / subscription rooms** — programmable revenue models, fees auto-split between room owner and protocol treasury
- **Encrypted payment memo** — attach an AES-256 encrypted note to any SUI transfer; only the counterparty can decrypt
- **Private rooms = true E2E** — AES-256 generated client-side, distributed peer-to-peer via invite envelope
- **Public rooms = encrypted-at-rest** — on-chain key sharing so any visitor can join (transparent disclosure, not blanket E2E)
- **Self-destruct by Move policy** — room close → key burn → ciphertext on IPFS stays mathematically unreadable

**Target users:** creator paid DMs · OTC trader negotiation rooms · Web3 team payroll · private invoicing.

## Tech stack

| Layer | Stack |
| --- | --- |
| Smart contract | Sui Move, published as a single package |
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript |
| Wallet | [`@mysten/dapp-kit`](https://sdk.mystenlabs.com/dapp-kit) 0.16 + Sui Wallet Standard |
| Sui SDK | [`@mysten/sui`](https://sdk.mystenlabs.com/typescript) 1.36 |
| State / RPC | `@tanstack/react-query` 5, 5-second polling in lieu of `onAccountChange` |
| Storage | Pinata (IPFS) · filesystem · in-memory (pick one) |

## Monorepo layout

```
sosui_media/
├── move/                          # Sui Move package + deploy scripts
│   ├── sources/ephemeral_chat.move
│   ├── tests/                     # Move unit tests
│   └── scripts/                   # publish / check / update-* / withdraw
└── src/
    ├── app/                       # Next.js routes
    │   ├── page.tsx               # landing
    │   ├── rooms/                 # list / create / [id]
    │   ├── admin/                 # AdminCap-gated config UI
    │   ├── roadmap/
    │   └── api/blob/              # ciphertext blob proxy
    ├── components/                # Topbar, Footer, AppProviders, ScrollNarrative, …
    └── lib/                       # sui client, useSignAndExec, crypto, …
```

## Quick start

### 1. Deploy the Move package

Requires [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) 1.30+ and Node 20+.

```bash
cd move
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY (bech32 format — get it via `sui keytool export <addr>`)
npm install
npm run check         # confirm the wallet holds SUI
npm run publish       # build + publish + write .deploy.json + sync ../.env.local
```

`publish` writes `NEXT_PUBLIC_SUI_*` variables into the repo-root `.env.local` automatically.
See [move/README.md](move/README.md) for the full deploy / admin / upgrade flow.

### 2. Frontend

```bash
# from repo root
cp .env.example .env.local
# .env.local should already be populated with SUI_* vars by `npm run publish`
npm install
npm run dev           # http://localhost:3000
```

Other scripts:

```bash
npm run build         # production build
npm run lint
npm run typecheck     # tsc --noEmit
```

## Environment variables

`.env.local` (full template in [.env.example](.env.example)):

```env
# Sui chain
NEXT_PUBLIC_SUI_NETWORK=testnet                          # devnet | testnet | mainnet
NEXT_PUBLIC_SUI_RPC=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_SUI_PACKAGE_ID=0x...   # ← populated by npm run publish
NEXT_PUBLIC_SUI_CONFIG_ID=0x...    # ← populated by npm run publish
NEXT_PUBLIC_SUI_TREASURY=0x...     # ← populated by npm run publish

# Blob storage (Pinata / filesystem / in-memory — pick one)
PINATA_JWT=
PINATA_GATEWAY=
BLOB_DIR=
```

## Wallet compatibility

The dApp connects to wallets via the Sui Wallet Standard. Observed locally:

| Wallet | Status | Notes |
| --- | --- | --- |
| Slush (Mysten official) | ✅ Full support | Recommended |
| Phantom | ⚠️ Testnet / mainnet only | Rejects the `sui:devnet` chain ID |
| OKX Wallet | ❌ PTB render crash | Awaiting OKX fix; not addressable from the dApp side |

`src/lib/useSignAndExec.ts` uses a hybrid strategy: try `signTransaction` first (cleaner RPC routing), fall back to the wallet's `signAndExecuteTransaction` on error — except on explicit "user rejected" where we propagate.

## Admin

`/admin` provides an AdminCap-gated UI for editing fee, TTL, message cap, and treasury. The CLI scripts under [move/scripts](move/scripts/) (`update-fees`, `update-treasury`, `withdraw`, …) cover the same surface from the terminal. See [move/README.md](move/README.md) for details.

## Roadmap

- **Phase 1 — Foundation: Encrypted Ephemeral Rooms** (shipped on testnet) — pay SUI to create a room, AES-256 client-side encryption, IPFS / Pinata ciphertext, TTL + message cap enforced on-chain, close → burn key self-destruct
- **Phase 2 — Programmable Private Payments** *(Sui Overflow 2026 submission · in progress)* — PTB-atomic `transfer + encrypted memo + on-chain commit`, tip-a-message, paid DM rooms, auto fee split (owner + treasury), mainnet deployment path
- **Phase 3 — Account Abstraction & Recurring Payments** — stack Sui's native AA primitives: **USDsui gasless transfer** (Stripe-issued stablecoin, protocol-level gas), **zkLogin onboarding** (no seed phrase), **sponsored transactions** (sui-gas-pool / Shinami), **session keys** (one popup per room). Powers subscription rooms with USDsui auto-debit and SUI/USDsui streaming payroll. Aligned with Sui's roadmap toward deeper protocol-level gas abstraction + confidential transactions.
- **Phase 4 — Token Economy & DAO** — `$SOSUI` (Sui Coin standard), stake-to-free, token-gated VIP rooms, protocol fees auto buy-back & burn, DAO governance
- **Phase 5 — Scale & Agent Economy** — Pinata → Walrus migration, Seal threshold key management, **x402 protocol integration** (HTTP-native pay-per-request for AI agents and gated APIs, priced in SUI / USDsui), mobile (React Native), cross-chain bridge-in

The in-app `/roadmap` has the full timeline.

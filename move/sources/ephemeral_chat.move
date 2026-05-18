module sosui_media::ephemeral_chat;

use std::string::{Self, String};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

// === Constants ===

const MAX_NAME_LEN: u64 = 64;
const MAX_DESC_LEN: u64 = 256;
const MAX_CID_LEN: u64 = 96;
const MAX_PUBKEY_HEX_LEN: u64 = 130;

const ROOM_ID_LEN: u64 = 16;
const ROOM_KEY_LEN: u64 = 32;
const CONTENT_HASH_LEN: u64 = 32;

// Fees denominated in MIST. 1 SUI = 1_000_000_000 MIST.
const DEFAULT_PUBLIC_FEE: u64 = 0;
const DEFAULT_PRIVATE_FEE: u64 = 10_000_000; // 0.01 SUI

// TTLs in milliseconds — Sui's Clock is millisecond-precision.
const DEFAULT_PUBLIC_TTL_MS: u64 = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_PRIVATE_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_MAX_MESSAGES: u64 = 1000;

// === Status / Visibility (kept as u8 for stable wire format) ===

const STATUS_OPEN: u8 = 0;
const STATUS_CLOSED: u8 = 1;
const STATUS_BURNED: u8 = 2;

const VISIBILITY_PUBLIC: u8 = 0;
const VISIBILITY_PRIVATE: u8 = 1;

// === Errors ===

const E_UNAUTHORIZED: u64 = 0;
const E_ROOM_CLOSED: u64 = 1;
const E_NAME_TOO_LONG: u64 = 2;
const E_DESC_TOO_LONG: u64 = 3;
const E_CID_TOO_LONG: u64 = 4;
const E_PUBKEY_TOO_LONG: u64 = 5;
const E_ROOM_EXPIRED: u64 = 6;
const E_CAP_REACHED: u64 = 7;
const E_BAD_TTL: u64 = 8;
const E_BAD_CAP: u64 = 9;
const E_BAD_LENGTH: u64 = 10;
const E_INSUFFICIENT_FEE: u64 = 11;
const E_HAS_ACTIVE_BOUNTIES: u64 = 12;

// === Objects ===

/// Capability proving admin authority. Minted once in `init` and transferred
/// to the publisher. Replaces Solana's `has_one = admin` check.
public struct AdminCap has key, store {
    id: UID,
}

/// Global config, shared on publish.
public struct Config has key {
    id: UID,
    /// Address that receives SUI fees from create_room.
    treasury: address,
    room_count: u64,
    version: u8,
    public_fee: u64,
    private_fee: u64,
    public_ttl_ms: u64,
    private_ttl_ms: u64,
    max_messages: u64,
}

/// Per-room shared object. Must be shared because `add_message` is callable
/// by anyone joined to the room.
public struct Room has key {
    id: UID,
    room_id: vector<u8>,
    owner: address,
    name: String,
    description: String,
    /// Hex-encoded ECDH public key the owner published so members can wrap a room key for them.
    owner_pubkey_hex: String,
    fee_paid: u64,
    status: u8,
    visibility: u8,
    message_count: u64,
    created_at_ms: u64,
    closed_at_ms: u64,
    expires_at_ms: u64,
    version: u8,
    /// On-chain room key for public rooms (random at create, emptied on burn).
    /// Always empty for private rooms — their real key never touches chain.
    room_key: vector<u8>,
    /// Count of bounties posted into this room that are not yet terminal
    /// (RELEASED / CANCELLED). Mutated by sosui_media::bounty via the
    /// `public(package)` helpers below. close_room aborts if this is non-zero.
    active_bounty_count: u64,
}

// === Events ===

public struct RoomCreated has copy, drop {
    room: ID,
    room_id: vector<u8>,
    owner: address,
    fee_paid: u64,
    timestamp_ms: u64,
}

public struct MessageAdded has copy, drop {
    room: ID,
    sender: address,
    cid: String,
    content_hash: vector<u8>,
    index: u64,
    timestamp_ms: u64,
}

public struct RoomClosed has copy, drop {
    room: ID,
    room_id: vector<u8>,
    owner: address,
    timestamp_ms: u64,
}

// === Init ===

/// Runs once on publish. Mints AdminCap to publisher and shares Config.
/// Treasury defaults to publisher — admin can rotate it later via `update_treasury`.
fun init(ctx: &mut TxContext) {
    let admin = ctx.sender();

    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        admin,
    );

    let config = Config {
        id: object::new(ctx),
        treasury: admin,
        room_count: 0,
        version: 3,
        public_fee: DEFAULT_PUBLIC_FEE,
        private_fee: DEFAULT_PRIVATE_FEE,
        public_ttl_ms: DEFAULT_PUBLIC_TTL_MS,
        private_ttl_ms: DEFAULT_PRIVATE_TTL_MS,
        max_messages: DEFAULT_MAX_MESSAGES,
    };
    transfer::share_object(config);
}

// === Admin (require AdminCap) ===

public fun update_fees(
    _: &AdminCap,
    config: &mut Config,
    public_fee: u64,
    private_fee: u64,
) {
    config.public_fee = public_fee;
    config.private_fee = private_fee;
}

public fun update_ttls(
    _: &AdminCap,
    config: &mut Config,
    public_ttl_ms: u64,
    private_ttl_ms: u64,
) {
    assert!(public_ttl_ms > 0, E_BAD_TTL);
    assert!(private_ttl_ms > 0, E_BAD_TTL);
    config.public_ttl_ms = public_ttl_ms;
    config.private_ttl_ms = private_ttl_ms;
}

public fun update_max_messages(
    _: &AdminCap,
    config: &mut Config,
    max_messages: u64,
) {
    assert!(max_messages > 0, E_BAD_CAP);
    config.max_messages = max_messages;
}

public fun update_treasury(
    _: &AdminCap,
    config: &mut Config,
    new_treasury: address,
) {
    config.treasury = new_treasury;
}

// === User entries ===

/// Create a room.
///
/// Splits `fee` MIST out of `payment` and sends it to the configured treasury;
/// any remainder is returned to the sender. Public rooms store `room_key` on
/// chain; private rooms store empty bytes — their real key lives client-side
/// and is shared via invite link.
public fun create_room(
    config: &mut Config,
    room_id: vector<u8>,
    name: vector<u8>,
    description: vector<u8>,
    owner_pubkey_hex: vector<u8>,
    is_public: bool,
    room_key: vector<u8>,
    mut payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(room_id.length() == ROOM_ID_LEN, E_BAD_LENGTH);
    assert!(room_key.length() == ROOM_KEY_LEN, E_BAD_LENGTH);
    assert!(name.length() <= MAX_NAME_LEN, E_NAME_TOO_LONG);
    assert!(description.length() <= MAX_DESC_LEN, E_DESC_TOO_LONG);
    assert!(owner_pubkey_hex.length() <= MAX_PUBKEY_HEX_LEN, E_PUBKEY_TOO_LONG);

    let (fee, ttl_ms) = if (is_public) {
        (config.public_fee, config.public_ttl_ms)
    } else {
        (config.private_fee, config.private_ttl_ms)
    };

    assert!(payment.value() >= fee, E_INSUFFICIENT_FEE);

    let creator = ctx.sender();

    // Split fee → treasury; refund (or destroy) the remainder.
    if (fee > 0) {
        let paid = coin::split(&mut payment, fee, ctx);
        transfer::public_transfer(paid, config.treasury);
    };
    if (payment.value() == 0) {
        coin::destroy_zero(payment);
    } else {
        transfer::public_transfer(payment, creator);
    };

    let now_ms = clock::timestamp_ms(clock);
    let visibility = if (is_public) VISIBILITY_PUBLIC else VISIBILITY_PRIVATE;
    let stored_key = if (is_public) room_key else vector[];

    let room = Room {
        id: object::new(ctx),
        room_id,
        owner: creator,
        name: string::utf8(name),
        description: string::utf8(description),
        owner_pubkey_hex: string::utf8(owner_pubkey_hex),
        fee_paid: fee,
        status: STATUS_OPEN,
        visibility,
        message_count: 0,
        created_at_ms: now_ms,
        closed_at_ms: 0,
        expires_at_ms: now_ms + ttl_ms,
        version: 5,
        room_key: stored_key,
        active_bounty_count: 0,
    };

    config.room_count = config.room_count + 1;

    event::emit(RoomCreated {
        room: object::uid_to_inner(&room.id),
        room_id: room.room_id,
        owner: creator,
        fee_paid: fee,
        timestamp_ms: now_ms,
    });

    transfer::share_object(room);
}

/// Append a message CID to the room. Anyone joined can call.
/// The actual ciphertext lives on IPFS — only CID + content_hash is on chain
/// (and only via the event log; we don't store messages on the Room object).
public fun add_message(
    config: &Config,
    room: &mut Room,
    cid: vector<u8>,
    content_hash: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(cid.length() <= MAX_CID_LEN, E_CID_TOO_LONG);
    assert!(content_hash.length() == CONTENT_HASH_LEN, E_BAD_LENGTH);

    let now_ms = clock::timestamp_ms(clock);
    assert!(room.status == STATUS_OPEN, E_ROOM_CLOSED);
    assert!(now_ms < room.expires_at_ms, E_ROOM_EXPIRED);
    assert!(room.message_count < config.max_messages, E_CAP_REACHED);

    room.message_count = room.message_count + 1;

    event::emit(MessageAdded {
        room: object::uid_to_inner(&room.id),
        sender: ctx.sender(),
        cid: string::utf8(cid),
        content_hash,
        index: room.message_count,
        timestamp_ms: now_ms,
    });
}

/// Owner closes the room. Flips status to Closed; new messages are blocked.
/// For PUBLIC rooms the on-chain `room_key` is preserved — owner can call
/// `burn_room_key` afterwards as an explicit second step to zero the key.
public fun close_room(
    room: &mut Room,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(room.status == STATUS_OPEN, E_ROOM_CLOSED);
    assert!(room.owner == ctx.sender(), E_UNAUTHORIZED);
    assert!(room.active_bounty_count == 0, E_HAS_ACTIVE_BOUNTIES);

    room.status = STATUS_CLOSED;
    room.closed_at_ms = clock::timestamp_ms(clock);

    event::emit(RoomClosed {
        room: object::uid_to_inner(&room.id),
        room_id: room.room_id,
        owner: room.owner,
        timestamp_ms: room.closed_at_ms,
    });
}

/// Owner empties the on-chain `room_key` for a PUBLIC room that is already
/// Closed. Two-step flow: `close_room` (Open → Closed, key preserved), then
/// `burn_room_key` (Closed → Burned, key emptied). Once burned, no new
/// visitor reading the chain can recover the key.
public fun burn_room_key(
    room: &mut Room,
    ctx: &TxContext,
) {
    assert!(room.owner == ctx.sender(), E_UNAUTHORIZED);
    assert!(room.visibility == VISIBILITY_PUBLIC, E_UNAUTHORIZED);
    assert!(room.status == STATUS_CLOSED, E_ROOM_CLOSED);
    room.room_key = vector[];
    room.status = STATUS_BURNED;
}

// === Accessors (for tests, and for other Move modules that consume our state) ===

public fun treasury(c: &Config): address { c.treasury }
public fun room_count(c: &Config): u64 { c.room_count }
public fun public_fee(c: &Config): u64 { c.public_fee }
public fun private_fee(c: &Config): u64 { c.private_fee }
public fun public_ttl_ms(c: &Config): u64 { c.public_ttl_ms }
public fun private_ttl_ms(c: &Config): u64 { c.private_ttl_ms }
public fun max_messages(c: &Config): u64 { c.max_messages }

public fun owner(r: &Room): address { r.owner }
public fun room_id(r: &Room): &vector<u8> { &r.room_id }
public fun status(r: &Room): u8 { r.status }
public fun is_open(r: &Room): bool { r.status == STATUS_OPEN }
public fun visibility(r: &Room): u8 { r.visibility }
public fun fee_paid(r: &Room): u64 { r.fee_paid }
public fun message_count(r: &Room): u64 { r.message_count }
public fun created_at_ms(r: &Room): u64 { r.created_at_ms }
public fun closed_at_ms(r: &Room): u64 { r.closed_at_ms }
public fun expires_at_ms(r: &Room): u64 { r.expires_at_ms }
public fun room_key(r: &Room): &vector<u8> { &r.room_key }
public fun active_bounty_count(r: &Room): u64 { r.active_bounty_count }

// === Package-private helpers (used by sosui_media::bounty) ===

/// Bump the active bounty counter. Called by bounty::post_bounty.
public(package) fun inc_active_bounties(r: &mut Room) {
    r.active_bounty_count = r.active_bounty_count + 1;
}

/// Decrement the active bounty counter. Called by bounty's terminal
/// transitions (release / cancel / self-release / dispute resolve).
/// Aborts if already zero — that would be a bookkeeping bug.
public(package) fun dec_active_bounties(r: &mut Room) {
    assert!(r.active_bounty_count > 0, E_HAS_ACTIVE_BOUNTIES);
    r.active_bounty_count = r.active_bounty_count - 1;
}

// === Test helpers ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

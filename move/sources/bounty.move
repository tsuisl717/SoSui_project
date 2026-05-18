module sosui_media::bounty;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

use sosui_media::ephemeral_chat::{Self, AdminCap, Room};

// === Constants ===

const MAX_TITLE_LEN: u64 = 96;
const MAX_CID_LEN: u64 = 96;

const STATUS_OPEN:      u8 = 0;
const STATUS_CLAIMED:   u8 = 1;
const STATUS_SUBMITTED: u8 = 2;
const STATUS_RELEASED:  u8 = 3;
const STATUS_CANCELLED: u8 = 4;
const STATUS_DISPUTED:  u8 = 5;

const MIN_WINDOW_MS: u64 = 60_000;                       // 1 minute
const MAX_WINDOW_MS: u64 = 90 * 24 * 60 * 60 * 1000;     // 90 days

// === Errors ===

const E_UNAUTHORIZED:   u64 = 0;
const E_BAD_STATUS:     u64 = 1;
const E_BAD_AMOUNT:     u64 = 2;
const E_BAD_WINDOW:     u64 = 3;
const E_INSUFFICIENT:   u64 = 4;
const E_TITLE_TOO_LONG: u64 = 5;
const E_CID_TOO_LONG:   u64 = 6;
const E_SELF_CLAIM:     u64 = 7;
const E_NOT_EXPIRED:    u64 = 8;
const E_EXPIRED:        u64 = 9;
const E_ROOM_MISMATCH:  u64 = 10;
const E_ROOM_NOT_OPEN:  u64 = 11;
const E_BAD_SPLIT:      u64 = 12;

// === Objects ===

/// A bounty posted in a Room. Funds are locked at post-time; lifecycle is
/// OPEN → CLAIMED → SUBMITTED → RELEASED, with optional DISPUTED branch
/// (admin-resolved) and CANCELLED branch (poster cancels OPEN bounty or
/// room sweep refunds).
public struct Bounty has key {
    id: UID,
    /// ID of the Room this bounty belongs to.
    room: ID,
    poster: address,
    /// Total bounty amount in MIST. Equals `locked.value()` until payout.
    amount: u64,
    locked: Balance<SUI>,
    title: String,
    /// IPFS CID for the brief. Public rooms may use plaintext; private encrypted.
    brief_cid: String,
    status: u8,
    /// Set when status >= CLAIMED.
    claimer: Option<address>,
    /// Set when status == SUBMITTED or beyond. IPFS CID of deliverable.
    submission_cid: Option<String>,
    /// How long claimer has to submit after claiming, in ms.
    claim_window_ms: u64,
    /// How long poster has to verify after submission, in ms.
    review_window_ms: u64,
    /// `claimed_at_ms + claim_window_ms`. Zero until claimed.
    claim_deadline_ms: u64,
    /// `submitted_at_ms + review_window_ms`. Zero until submitted.
    review_deadline_ms: u64,
    created_at_ms: u64,
}

// === Events ===

public struct BountyPosted has copy, drop {
    bounty: ID,
    room: ID,
    poster: address,
    amount: u64,
    title: String,
    brief_cid: String,
    claim_window_ms: u64,
    review_window_ms: u64,
    timestamp_ms: u64,
}

public struct BountyClaimed has copy, drop {
    bounty: ID,
    claimer: address,
    claim_deadline_ms: u64,
    timestamp_ms: u64,
}

public struct BountyReopened has copy, drop {
    bounty: ID,
    prior_claimer: address,
    timestamp_ms: u64,
}

public struct BountySubmitted has copy, drop {
    bounty: ID,
    claimer: address,
    submission_cid: String,
    review_deadline_ms: u64,
    timestamp_ms: u64,
}

public struct BountyReleased has copy, drop {
    bounty: ID,
    claimer: address,
    amount: u64,
    /// True if released via `claim_after_review_timeout` (poster ghosted) or
    /// `resolve_on_room_close` (room swept). False on normal poster release.
    auto_released: bool,
    timestamp_ms: u64,
}

public struct BountyCancelled has copy, drop {
    bounty: ID,
    poster: address,
    amount: u64,
    timestamp_ms: u64,
}

public struct BountyDisputed has copy, drop {
    bounty: ID,
    raised_by: address,
    reason_cid: String,
    timestamp_ms: u64,
}

public struct DisputeResolved has copy, drop {
    bounty: ID,
    to_claimer: u64,
    to_poster: u64,
    verdict_cid: String,
    timestamp_ms: u64,
}

// === Posting ===

/// Poster locks `amount` MIST out of `payment` into the new Bounty and shares
/// it. Any excess in `payment` is refunded to the poster. Room must be OPEN.
/// Bumps the room's active bounty counter — close_room is blocked until this
/// bounty reaches a terminal state.
public fun post_bounty(
    room: &mut Room,
    mut payment: Coin<SUI>,
    amount: u64,
    title: vector<u8>,
    brief_cid: vector<u8>,
    claim_window_ms: u64,
    review_window_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(ephemeral_chat::is_open(room), E_ROOM_NOT_OPEN);
    assert!(amount > 0, E_BAD_AMOUNT);
    assert!(payment.value() >= amount, E_INSUFFICIENT);
    assert!(title.length() <= MAX_TITLE_LEN, E_TITLE_TOO_LONG);
    assert!(brief_cid.length() <= MAX_CID_LEN, E_CID_TOO_LONG);
    assert!(
        claim_window_ms >= MIN_WINDOW_MS && claim_window_ms <= MAX_WINDOW_MS,
        E_BAD_WINDOW,
    );
    assert!(
        review_window_ms >= MIN_WINDOW_MS && review_window_ms <= MAX_WINDOW_MS,
        E_BAD_WINDOW,
    );

    let poster = ctx.sender();

    let paid = coin::split(&mut payment, amount, ctx);
    let mut locked = balance::zero<SUI>();
    balance::join(&mut locked, coin::into_balance(paid));
    refund_remainder(payment, poster);

    let now_ms = clock::timestamp_ms(clock);
    let title_str = string::utf8(title);
    let brief_str = string::utf8(brief_cid);
    let room_id = object::id(room);

    let b = Bounty {
        id: object::new(ctx),
        room: room_id,
        poster,
        amount,
        locked,
        title: title_str,
        brief_cid: brief_str,
        status: STATUS_OPEN,
        claimer: option::none<address>(),
        submission_cid: option::none<String>(),
        claim_window_ms,
        review_window_ms,
        claim_deadline_ms: 0,
        review_deadline_ms: 0,
        created_at_ms: now_ms,
    };

    event::emit(BountyPosted {
        bounty: object::uid_to_inner(&b.id),
        room: room_id,
        poster,
        amount,
        title: title_str,
        brief_cid: brief_str,
        claim_window_ms,
        review_window_ms,
        timestamp_ms: now_ms,
    });

    ephemeral_chat::inc_active_bounties(room);
    transfer::share_object(b);
}

// === Claiming ===

/// Caller takes the bounty slot. First-come-first-served; cannot claim own.
public fun claim_bounty(b: &mut Bounty, clock: &Clock, ctx: &TxContext) {
    assert!(b.status == STATUS_OPEN, E_BAD_STATUS);
    let sender = ctx.sender();
    assert!(sender != b.poster, E_SELF_CLAIM);

    let now_ms = clock::timestamp_ms(clock);
    b.claimer = option::some(sender);
    b.claim_deadline_ms = now_ms + b.claim_window_ms;
    b.status = STATUS_CLAIMED;

    event::emit(BountyClaimed {
        bounty: object::uid_to_inner(&b.id),
        claimer: sender,
        claim_deadline_ms: b.claim_deadline_ms,
        timestamp_ms: now_ms,
    });
}

/// Anyone may reset a CLAIMED bounty back to OPEN after the claim deadline
/// passes without a submission. Prevents claimers from squatting on bounties.
public fun reopen_expired(b: &mut Bounty, clock: &Clock, _ctx: &TxContext) {
    assert!(b.status == STATUS_CLAIMED, E_BAD_STATUS);
    let now_ms = clock::timestamp_ms(clock);
    assert!(now_ms >= b.claim_deadline_ms, E_NOT_EXPIRED);

    let prior = *option::borrow(&b.claimer);
    b.claimer = option::none();
    b.claim_deadline_ms = 0;
    b.status = STATUS_OPEN;

    event::emit(BountyReopened {
        bounty: object::uid_to_inner(&b.id),
        prior_claimer: prior,
        timestamp_ms: now_ms,
    });
}

// === Submission ===

/// Claimer posts the deliverable CID. Must still be within the claim window.
public fun submit_work(
    b: &mut Bounty,
    submission_cid: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(b.status == STATUS_CLAIMED, E_BAD_STATUS);
    let sender = ctx.sender();
    assert!(b.claimer.contains(&sender), E_UNAUTHORIZED);
    assert!(submission_cid.length() <= MAX_CID_LEN, E_CID_TOO_LONG);
    let now_ms = clock::timestamp_ms(clock);
    assert!(now_ms < b.claim_deadline_ms, E_EXPIRED);

    let cid_str = string::utf8(submission_cid);
    b.submission_cid = option::some(cid_str);
    b.review_deadline_ms = now_ms + b.review_window_ms;
    b.status = STATUS_SUBMITTED;

    event::emit(BountySubmitted {
        bounty: object::uid_to_inner(&b.id),
        claimer: sender,
        submission_cid: cid_str,
        review_deadline_ms: b.review_deadline_ms,
        timestamp_ms: now_ms,
    });
}

// === Payout paths ===

/// Poster verifies the submission and releases funds to the claimer.
/// Decrements the room's active bounty counter.
public fun release_bounty(
    b: &mut Bounty,
    room: &mut Room,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(b.status == STATUS_SUBMITTED, E_BAD_STATUS);
    assert!(b.room == object::id(room), E_ROOM_MISMATCH);
    assert!(ctx.sender() == b.poster, E_UNAUTHORIZED);
    payout_to_claimer(b, false, clock, ctx);
    ephemeral_chat::dec_active_bounties(room);
}

/// Claimer self-releases after the review window expires (poster ghosted).
public fun claim_after_review_timeout(
    b: &mut Bounty,
    room: &mut Room,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(b.status == STATUS_SUBMITTED, E_BAD_STATUS);
    assert!(b.room == object::id(room), E_ROOM_MISMATCH);
    let sender = ctx.sender();
    assert!(b.claimer.contains(&sender), E_UNAUTHORIZED);
    let now_ms = clock::timestamp_ms(clock);
    assert!(now_ms >= b.review_deadline_ms, E_NOT_EXPIRED);
    payout_to_claimer(b, true, clock, ctx);
    ephemeral_chat::dec_active_bounties(room);
}

/// Poster cancels an unclaimed bounty and recovers the locked funds.
public fun cancel_bounty(
    b: &mut Bounty,
    room: &mut Room,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(b.status == STATUS_OPEN, E_BAD_STATUS);
    assert!(b.room == object::id(room), E_ROOM_MISMATCH);
    assert!(ctx.sender() == b.poster, E_UNAUTHORIZED);
    refund_to_poster(b, clock, ctx);
    ephemeral_chat::dec_active_bounties(room);
}

// === Dispute & resolution ===

/// Either party flags a dispute. Funds freeze until admin resolves.
/// Reason text is encrypted off-chain; only the CID is anchored on chain.
public fun dispute_bounty(
    b: &mut Bounty,
    reason_cid: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    let is_poster = sender == b.poster;
    let is_claimer = b.claimer.contains(&sender);
    assert!(is_poster || is_claimer, E_UNAUTHORIZED);
    assert!(
        b.status == STATUS_CLAIMED || b.status == STATUS_SUBMITTED,
        E_BAD_STATUS,
    );
    assert!(reason_cid.length() <= MAX_CID_LEN, E_CID_TOO_LONG);

    let reason_str = string::utf8(reason_cid);
    b.status = STATUS_DISPUTED;
    let now_ms = clock::timestamp_ms(clock);

    event::emit(BountyDisputed {
        bounty: object::uid_to_inner(&b.id),
        raised_by: sender,
        reason_cid: reason_str,
        timestamp_ms: now_ms,
    });
}

/// Admin verdict on a disputed bounty. Splits the locked amount between
/// claimer and poster — `to_claimer + to_poster` must equal `amount`.
/// Supports any ratio (100/0, 0/100, 60/40, etc).
/// Decrements the room's active bounty counter (DISPUTED → RELEASED is
/// a terminal transition).
public fun resolve_dispute(
    _: &AdminCap,
    b: &mut Bounty,
    room: &mut Room,
    to_claimer: u64,
    to_poster: u64,
    verdict_cid: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(b.status == STATUS_DISPUTED, E_BAD_STATUS);
    assert!(b.room == object::id(room), E_ROOM_MISMATCH);
    assert!(to_claimer + to_poster == b.amount, E_BAD_SPLIT);
    assert!(verdict_cid.length() <= MAX_CID_LEN, E_CID_TOO_LONG);

    if (to_claimer > 0) {
        let claimer = *option::borrow(&b.claimer);
        let part = balance::split(&mut b.locked, to_claimer);
        transfer::public_transfer(coin::from_balance(part, ctx), claimer);
    };
    if (to_poster > 0) {
        let part = balance::split(&mut b.locked, to_poster);
        transfer::public_transfer(coin::from_balance(part, ctx), b.poster);
    };

    b.status = STATUS_RELEASED;
    let now_ms = clock::timestamp_ms(clock);
    event::emit(DisputeResolved {
        bounty: object::uid_to_inner(&b.id),
        to_claimer,
        to_poster,
        verdict_cid: string::utf8(verdict_cid),
        timestamp_ms: now_ms,
    });

    ephemeral_chat::dec_active_bounties(room);
}

// === Internal ===

fun payout_to_claimer(
    b: &mut Bounty,
    auto_released: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let claimer = *option::borrow(&b.claimer);
    let amount = b.amount;
    let bal = balance::withdraw_all(&mut b.locked);
    transfer::public_transfer(coin::from_balance(bal, ctx), claimer);
    b.status = STATUS_RELEASED;
    event::emit(BountyReleased {
        bounty: object::uid_to_inner(&b.id),
        claimer,
        amount,
        auto_released,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}

fun refund_to_poster(b: &mut Bounty, clock: &Clock, ctx: &mut TxContext) {
    let amount = b.amount;
    let bal = balance::withdraw_all(&mut b.locked);
    transfer::public_transfer(coin::from_balance(bal, ctx), b.poster);
    b.status = STATUS_CANCELLED;
    event::emit(BountyCancelled {
        bounty: object::uid_to_inner(&b.id),
        poster: b.poster,
        amount,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}

fun refund_remainder(c: Coin<SUI>, to: address) {
    if (c.value() == 0) {
        coin::destroy_zero(c);
    } else {
        transfer::public_transfer(c, to);
    }
}

// === Accessors ===

public fun poster(b: &Bounty): address { b.poster }
public fun amount(b: &Bounty): u64 { b.amount }
public fun status(b: &Bounty): u8 { b.status }
public fun room_of(b: &Bounty): ID { b.room }
public fun claimer(b: &Bounty): &Option<address> { &b.claimer }
public fun submission_cid(b: &Bounty): &Option<String> { &b.submission_cid }
public fun claim_deadline_ms(b: &Bounty): u64 { b.claim_deadline_ms }
public fun review_deadline_ms(b: &Bounty): u64 { b.review_deadline_ms }
public fun locked_value(b: &Bounty): u64 { balance::value(&b.locked) }
public fun title(b: &Bounty): &String { &b.title }
public fun brief_cid(b: &Bounty): &String { &b.brief_cid }

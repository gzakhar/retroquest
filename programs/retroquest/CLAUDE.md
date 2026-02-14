# Solana Program - CLAUDE.md

Technical guidance for working with the RetroQuest Solana program.

## Overview

This is a **native Solana program** using the `solana-program` crate directly—not Anchor. This means:
- Manual account deserialization and validation
- Explicit PDA derivation and verification
- Hand-written instruction parsing via Borsh

Program ID: `CZ1xaAyDaXa5GyWPHCytfcJjnmJhuFnVeHJLrYiijVLx`

## File Structure

| File | Purpose |
|------|---------|
| `lib.rs` | Entrypoint, program ID declaration |
| `state.rs` | Account structures and serialization |
| `instructions.rs` | Instruction enum with Borsh deserialization |
| `processor.rs` | Instruction handlers |
| `error.rs` | Custom errors using `thiserror` |

## Account Structures

| Account | Purpose |
|---------|---------|
| `FacilitatorRegistry` | Tracks board count per facilitator |
| `RetroBoard` | Main board: stages, categories, allowlist, voting credits, action_item_count |
| `BoardMembership` | Links participants to boards, tracks voting credits spent and total_score |
| `Note` | Individual notes with category, content, optional group assignment |
| `Group` | Groups of notes with vote tally |
| `VoteRecord` | Per-participant, per-group vote tracking |
| `ActionItem` | Task with owner, verifiers, threshold, approvals, status (Pending/Completed) |
| `VerificationVote` | Records a verifier's approval/rejection of an action item |

## PDA Seeds

These are the canonical seed patterns. **The UI must match these exactly.**

```rust
// Facilitator registry
["facilitator_registry", facilitator_pubkey]

// Board (uses little-endian u32 for index)
["board", facilitator_pubkey, board_index.to_le_bytes()]

// Membership
["membership", board_pubkey, participant_pubkey]

// Note (uses little-endian u32 for note_id)
["note", board_pubkey, note_id.to_le_bytes()]

// Group (uses little-endian u32 for group_id)
["group", board_pubkey, group_id.to_le_bytes()]

// Vote record
["vote", board_pubkey, participant_pubkey, group_id.to_le_bytes()]

// Action item
["action_item", board_pubkey, action_item_id.to_le_bytes()]

// Verification vote
["verification_vote", action_item_pubkey, verifier_pubkey]
```

## Board Stage Flow

Stages progress linearly. Only the facilitator can advance stages.

```
Setup → WriteNotes → GroupDuplicates → Vote → Discuss
```

## Key Constants

```rust
MAX_NOTE_CHARS: 280
MAX_GROUP_TITLE_CHARS: 80
MAX_PARTICIPANTS: 8
MAX_CATEGORIES: 5
MAX_CATEGORY_NAME_LEN: 32
VOTING_CREDITS_DEFAULT: 5
MAX_ACTION_DESCRIPTION_CHARS: 280
MAX_VERIFIERS: 7  // MAX_PARTICIPANTS - 1 (owner can't verify)
```

## Development Conventions

**Error handling**: Use custom errors from `error.rs`. Return descriptive errors that help debugging.

**Account validation**: Always verify:
- Account ownership (is it owned by this program?)
- PDA derivation (does the account match expected seeds?)
- Signer requirements (is the right party signing?)

**Serialization**: Use Borsh for all account data. Instructions use a variant byte to determine type.

**Testing**: Integration tests live in `/tests/` at the repo root. The test helpers use different seed names ("team_registry" vs "facilitator_registry")—be aware of this discrepancy when debugging.

## Build Commands

```bash
cargo build-sbf           # Development build
cargo build-sbf --release # Release build (use for deployment)
```

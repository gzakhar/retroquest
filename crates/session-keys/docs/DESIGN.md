# Session Keys Design Document

A library for implementing session keys in native Solana programs.

## Problem Statement

Solana dApps that require frequent user interactions suffer from poor UX due to constant wallet signing popups. Every action requires:

1. Build transaction
2. Wallet popup appears
3. User reviews and signs
4. Pay gas fee
5. Repeat

This friction discourages engagement in interactive applications.

## Solution: Session Keys

Session keys allow users to sign **once** to authorize a temporary ephemeral keypair. That keypair can then sign subsequent transactions without wallet popups.

Inspired by [MagicBlock's session-keys](https://github.com/magicblock-labs/session-keys) for Anchor programs, this library provides the same pattern for **native Solana programs**.

---

## Core Concepts

| Term | Definition |
|------|------------|
| **Authority** | The user's main wallet (the "real" signer) |
| **Session Signer** | An ephemeral keypair authorized to act on behalf of the authority |
| **Session Token** | An on-chain account proving the authority authorized the session signer |
| **Target Program** | The program where the session is valid |

---

## Session Token Account

```rust
pub const SESSION_TOKEN_SEED: &[u8] = b"session_token";

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy)]
pub struct SessionToken {
    pub authority: Pubkey,        // User's main wallet
    pub target_program: Pubkey,   // Program this session is valid for
    pub session_signer: Pubkey,   // Ephemeral keypair public key
    pub valid_until: i64,         // Unix timestamp (seconds)
}

impl SessionToken {
    pub const LEN: usize = 32 + 32 + 32 + 8; // 104 bytes
}
```

**PDA Seeds**: `["session_token", target_program, session_signer, authority]`

This seed order matches MagicBlock's session-keys for compatibility.

---

## Usage

### 1. Add Dependency

```toml
[dependencies]
session-keys = { path = "../crates/session-keys", features = ["no-entrypoint"] }
```

### 2. Implement Session Instructions

Your program needs to implement `CreateSession` and `RevokeSession` instructions:

```rust
use session_keys::{SessionToken, SESSION_TOKEN_SEED, calculate_valid_until};

// CreateSession instruction
pub fn process_create_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    valid_for_seconds: Option<i64>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let session_token_info = next_account_info(account_info_iter)?;
    let session_signer_info = next_account_info(account_info_iter)?;
    let authority_info = next_account_info(account_info_iter)?;
    let target_program_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Authority must sign to create session
    if !authority_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Session signer must also sign (proves ownership of ephemeral key)
    if !session_signer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify target program is executable
    if !target_program_info.executable {
        return Err(ProgramError::InvalidAccountData);
    }

    // Calculate expiration
    let valid_until = calculate_valid_until(valid_for_seconds)?;

    // Derive and verify PDA
    let (pda, bump) = SessionToken::find_address(
        target_program_info.key,
        session_signer_info.key,
        authority_info.key,
        program_id,
    );

    if pda != *session_token_info.key {
        return Err(ProgramError::InvalidSeeds);
    }

    // Create account and serialize
    // ... (standard PDA account creation)

    let session = SessionToken {
        authority: *authority_info.key,
        target_program: *target_program_info.key,
        session_signer: *session_signer_info.key,
        valid_until,
    };

    session.serialize(&mut *session_token_info.data.borrow_mut())?;

    Ok(())
}
```

### 3. Use Session Validation

In instructions that should support session-based signing:

```rust
use session_keys::validate_signer_or_session;

pub fn process_some_action(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let signer_info = next_account_info(account_info_iter)?;
    let authority_pubkey = /* the expected authority */;

    // Optional session token (last account if using session)
    let session_token_info = accounts.get(accounts.len() - 1);

    // This validates either:
    // 1. signer_info.key == authority_pubkey (direct wallet), OR
    // 2. signer_info is the session_signer for a valid session token
    validate_signer_or_session(
        signer_info,
        &authority_pubkey,
        session_token_info,
        program_id,  // session program (same as this program if embedded)
        program_id,  // target program
    )?;

    // Continue with instruction logic...
    Ok(())
}
```

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_VALIDITY_SECONDS` | 604,800 (7 days) | Maximum session duration |
| `DEFAULT_VALIDITY_SECONDS` | 3,600 (1 hour) | Default if not specified |
| `DEFAULT_TOP_UP_LAMPORTS` | 10,000,000 (0.01 SOL) | Optional session signer funding |

---

## Security Properties

| Property | Guarantee |
|----------|-----------|
| Program-scoped | Session for Program A can't be used on Program B |
| Time-limited | Session expires after specified duration (max 7 days) |
| Authority-bound | Only the original authority can create/revoke |
| Signer-specific | Only the designated ephemeral key can use the session |
| Revocable | Authority can end session early |

---

## Client-Side Integration

```typescript
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";

interface Session {
  ephemeralKeypair: Keypair;
  sessionTokenAddress: PublicKey;
  authority: PublicKey;
  targetProgram: PublicKey;
  validUntil: Date;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();

  async createSession(
    connection: Connection,
    wallet: WalletAdapter,
    targetProgram: PublicKey,
    sessionProgramId: PublicKey,
    durationSeconds: number = 3600,
  ): Promise<Session> {
    // Generate ephemeral keypair (stored in memory only!)
    const ephemeralKeypair = Keypair.generate();

    // Derive session token PDA
    const [sessionTokenAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("session_token"),
        targetProgram.toBuffer(),
        ephemeralKeypair.publicKey.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      sessionProgramId,
    );

    // Build and send CreateSession transaction
    // ... (wallet signs this one time)

    const session: Session = {
      ephemeralKeypair,
      sessionTokenAddress,
      authority: wallet.publicKey,
      targetProgram,
      validUntil: new Date(Date.now() + durationSeconds * 1000),
    };

    this.sessions.set(targetProgram.toBase58(), session);
    return session;
  }

  signWithSession(tx: Transaction, targetProgram: PublicKey): boolean {
    const session = this.sessions.get(targetProgram.toBase58());
    if (!session || new Date() > session.validUntil) {
      return false; // No valid session, caller should use wallet
    }

    tx.partialSign(session.ephemeralKeypair);
    return true;
  }

  getSession(targetProgram: PublicKey): Session | null {
    return this.sessions.get(targetProgram.toBase58()) ?? null;
  }
}
```

---

## Instruction Account Layouts

### CreateSession

```
Accounts:
0. [writable] Session token PDA
1. [signer]   Session signer (ephemeral keypair)
2. [signer]   Authority (user's wallet)
3. []         Target program (must be executable)
4. []         System program

Instruction Data:
- valid_for_seconds: Option<i64>
- top_up: Option<bool>
- lamports: Option<u64>
```

### RevokeSession

```
Accounts:
0. [writable] Session token PDA (will be closed)
1. [signer]   Authority (receives rent back)
2. []         System program
```

---

## Comparison with MagicBlock's Implementation

| Aspect | MagicBlock (Anchor) | This Library (Native) |
|--------|--------------------|-----------------------|
| Framework | Anchor | Native Solana |
| PDA Seeds | Same order | Same order |
| Max Validity | 7 days | 7 days |
| Top-up Support | Yes | Optional |
| V2 with Fee Payer | Yes | Not yet |
| Account Size | 8 + 104 (discriminator) | 104 bytes |

---

## Error Codes

Errors start at 6000 to avoid conflicts with standard Solana errors:

| Code | Error | Description |
|------|-------|-------------|
| 6000 | InvalidToken | Session token is invalid or uninitialized |
| 6001 | SessionExpired | Session has passed its valid_until time |
| 6002 | InvalidAuthority | Authority doesn't match session |
| 6003 | InvalidTargetProgram | Target program doesn't match |
| 6004 | InvalidSessionSigner | Session signer doesn't match |
| 6005 | MissingSessionSignature | Session signer didn't sign |
| 6006 | WrongOwner | Session token has wrong account owner |
| 6007 | ValidityTooLong | Requested duration exceeds 7 days |
| 6008 | NoToken | No session token provided |
| 6009 | ClockUnavailable | Clock sysvar unavailable |

---

## Future Enhancements

1. **V2 with Fee Payer**: Allow a separate account to pay for session creation
2. **Scoped Sessions**: Optional additional scope data for finer-grained permissions
3. **Standalone Program**: Extract to a reusable deployed program

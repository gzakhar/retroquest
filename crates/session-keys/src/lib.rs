//! # Session Keys
//!
//! A library for implementing session keys in native Solana programs.
//!
//! Session keys allow users to sign once to authorize an ephemeral keypair,
//! which can then sign subsequent transactions without wallet popups.
//!
//! Inspired by [MagicBlock's session-keys](https://github.com/magicblock-labs/session-keys).
//!
//! ## Usage
//!
//! 1. Add this crate as a dependency with `features = ["no-entrypoint"]`
//! 2. Implement `CreateSession` and `RevokeSession` instructions in your program
//! 3. Use `validate_session()` in instructions that should support session signing
//!
//! See `docs/DESIGN.md` for full details.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo,
    clock::Clock,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::Sysvar,
};

// ============================================================================
// Constants
// ============================================================================

/// Maximum session validity: 7 days in seconds
pub const MAX_VALIDITY_SECONDS: i64 = 60 * 60 * 24 * 7;

/// Default session validity: 1 hour in seconds
pub const DEFAULT_VALIDITY_SECONDS: i64 = 60 * 60;

/// Default top-up amount: 0.05 SOL in lamports
pub const DEFAULT_TOP_UP_LAMPORTS: u64 = 50_000_000;

// ============================================================================
// Session Token Account
// ============================================================================

/// Seed prefix for session token PDAs
pub const SESSION_TOKEN_SEED: &[u8] = b"session_token";

/// Session token account data.
///
/// Stores the authorization for an ephemeral keypair to act on behalf of an authority.
///
/// ## PDA Derivation
/// Seeds: `["session_token", target_program, session_signer, authority]`
///
/// This seed order matches MagicBlock's session-keys for compatibility.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy)]
pub struct SessionToken {
    /// Account type discriminator (set by consuming program)
    pub discriminator: u8,
    /// The user's main wallet that created this session
    pub authority: Pubkey,
    /// The program this session is valid for
    pub target_program: Pubkey,
    /// The ephemeral keypair authorized to sign on behalf of the authority
    pub session_signer: Pubkey,
    /// Unix timestamp (seconds) when this session expires
    pub valid_until: i64,
}

impl SessionToken {
    /// Account size in bytes
    /// discriminator(1) + authority(32) + target_program(32) + session_signer(32) + valid_until(8)
    pub const LEN: usize = 1 + 32 + 32 + 32 + 8;

    /// Seed prefix as string (for compatibility with Anchor-style seeds)
    pub const SEED_PREFIX: &'static str = "session_token";

    /// Derive the PDA address for a session token.
    ///
    /// Seeds: `["session_token", target_program, session_signer, authority]`
    pub fn find_address(
        target_program: &Pubkey,
        session_signer: &Pubkey,
        authority: &Pubkey,
        session_program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                SESSION_TOKEN_SEED,
                target_program.as_ref(),
                session_signer.as_ref(),
                authority.as_ref(),
            ],
            session_program_id,
        )
    }

    /// Get the PDA seeds for signing (includes bump)
    pub fn signer_seeds<'a>(
        target_program: &'a [u8],
        session_signer: &'a [u8],
        authority: &'a [u8],
        bump: &'a [u8],
    ) -> [&'a [u8]; 5] {
        [
            SESSION_TOKEN_SEED,
            target_program,
            session_signer,
            authority,
            bump,
        ]
    }

    /// Check if the session has expired
    pub fn is_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp > self.valid_until
    }

    /// Validate the session token
    pub fn validate(
        &self,
        session_token_key: &Pubkey,
        expected_authority: &Pubkey,
        expected_target_program: &Pubkey,
        session_signer_key: &Pubkey,
        session_program_id: &Pubkey,
    ) -> Result<(), SessionError> {
        // Verify PDA derivation
        let (expected_pda, _) = Self::find_address(
            &self.target_program,
            &self.session_signer,
            &self.authority,
            session_program_id,
        );
        if expected_pda != *session_token_key {
            return Err(SessionError::InvalidToken);
        }

        // Verify authority matches
        if self.authority != *expected_authority {
            return Err(SessionError::InvalidAuthority);
        }

        // Verify target program matches
        if self.target_program != *expected_target_program {
            return Err(SessionError::InvalidTargetProgram);
        }

        // Verify session signer matches
        if self.session_signer != *session_signer_key {
            return Err(SessionError::InvalidSessionSigner);
        }

        // Check expiration
        let clock = Clock::get().map_err(|_| SessionError::ClockUnavailable)?;
        if self.is_expired(clock.unix_timestamp) {
            return Err(SessionError::SessionExpired);
        }

        Ok(())
    }
}

// ============================================================================
// Errors
// ============================================================================

/// Session-related errors
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionError {
    /// Session token account is not initialized or invalid
    InvalidToken,
    /// Session token has expired
    SessionExpired,
    /// Session token authority doesn't match expected authority
    InvalidAuthority,
    /// Session token is for a different program
    InvalidTargetProgram,
    /// Session signer doesn't match the token
    InvalidSessionSigner,
    /// Session signer did not sign the transaction
    MissingSessionSignature,
    /// Session token account has wrong owner
    WrongOwner,
    /// Requested validity period is too long (max 7 days)
    ValidityTooLong,
    /// No session token provided when required
    NoToken,
    /// Clock sysvar unavailable
    ClockUnavailable,
}

impl From<SessionError> for ProgramError {
    fn from(e: SessionError) -> Self {
        // Use error codes 6000+ to avoid conflicts (similar to Anchor custom errors)
        ProgramError::Custom(6000 + e as u32)
    }
}

impl std::fmt::Display for SessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionError::InvalidToken => write!(f, "Invalid session token"),
            SessionError::SessionExpired => write!(f, "Session has expired"),
            SessionError::InvalidAuthority => write!(f, "Invalid authority"),
            SessionError::InvalidTargetProgram => write!(f, "Invalid target program"),
            SessionError::InvalidSessionSigner => write!(f, "Invalid session signer"),
            SessionError::MissingSessionSignature => write!(f, "Session signer did not sign"),
            SessionError::WrongOwner => write!(f, "Session token has wrong owner"),
            SessionError::ValidityTooLong => write!(f, "Requested validity is too long (max 7 days)"),
            SessionError::NoToken => write!(f, "No session token provided"),
            SessionError::ClockUnavailable => write!(f, "Clock sysvar unavailable"),
        }
    }
}

impl std::error::Error for SessionError {}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validates a session token for use in an instruction.
///
/// This function checks:
/// 1. Session token is owned by the session program
/// 2. Session token PDA is correctly derived
/// 3. Session token is for the correct authority and target program
/// 4. Session has not expired
/// 5. The session signer has signed the transaction
///
/// # Arguments
/// * `session_token_info` - The session token account
/// * `session_signer_info` - The account that signed (should be the ephemeral keypair)
/// * `expected_authority` - The authority pubkey we expect the session to be for
/// * `expected_target_program` - The program this session should be valid for
/// * `session_program_id` - The program ID that owns session tokens
///
/// # Returns
/// * `Ok(())` if validation passes
/// * `Err(SessionError)` if validation fails
pub fn validate_session(
    session_token_info: &AccountInfo,
    session_signer_info: &AccountInfo,
    expected_authority: &Pubkey,
    expected_target_program: &Pubkey,
    session_program_id: &Pubkey,
) -> Result<(), SessionError> {
    // Session token must be owned by session program
    if session_token_info.owner != session_program_id {
        return Err(SessionError::WrongOwner);
    }

    // Session signer must have signed
    if !session_signer_info.is_signer {
        return Err(SessionError::MissingSessionSignature);
    }

    if session_token_info.data_is_empty() {
        return Err(SessionError::InvalidToken);
    }

    let session = SessionToken::deserialize(&mut &session_token_info.data.borrow()[..])
        .map_err(|_| SessionError::InvalidToken)?;

    session.validate(
        session_token_info.key,
        expected_authority,
        expected_target_program,
        session_signer_info.key,
        session_program_id,
    )
}

/// Validates that either:
/// 1. The signer IS the authority (direct wallet signature), OR
/// 2. The signer is an authorized session signer with a valid session token
///
/// This is the main function consuming programs should use.
///
/// # Arguments
/// * `signer_info` - The account that signed the transaction
/// * `authority` - The expected authority pubkey (e.g., note author, voter)
/// * `session_token_info` - Optional session token account (None if not using session)
/// * `session_program_id` - The program ID that owns session token accounts
/// * `target_program_id` - The program ID the session should be valid for
///
/// # Returns
/// * `Ok(())` if validation passes
/// * `Err(ProgramError)` if validation fails
pub fn validate_signer_or_session(
    signer_info: &AccountInfo,
    authority: &Pubkey,
    session_token_info: Option<&AccountInfo>,
    session_program_id: &Pubkey,
    target_program_id: &Pubkey,
) -> Result<(), ProgramError> {
    // Case 1: Direct authority signature (normal wallet signing)
    if signer_info.is_signer && signer_info.key == authority {
        return Ok(());
    }

    // Case 2: Session-based signature
    let session_info = session_token_info.ok_or(ProgramError::MissingRequiredSignature)?;

    validate_session(
        session_info,
        signer_info,
        authority,
        target_program_id,
        session_program_id,
    )?;

    Ok(())
}

/// Calculate validity timestamp from duration, enforcing max limit.
///
/// # Arguments
/// * `valid_for_seconds` - Optional duration in seconds (defaults to 1 hour)
///
/// # Returns
/// * `Ok(valid_until)` - Unix timestamp when session expires
/// * `Err(SessionError::ValidityTooLong)` - If requested duration exceeds 7 days
pub fn calculate_valid_until(valid_for_seconds: Option<i64>) -> Result<i64, SessionError> {
    let duration = valid_for_seconds.unwrap_or(DEFAULT_VALIDITY_SECONDS);

    if duration > MAX_VALIDITY_SECONDS {
        return Err(SessionError::ValidityTooLong);
    }

    let clock = Clock::get().map_err(|_| SessionError::ClockUnavailable)?;
    Ok(clock.unix_timestamp + duration)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_token_len() {
        assert_eq!(SessionToken::LEN, 105);
    }

    #[test]
    fn test_is_expired() {
        let session = SessionToken {
            discriminator: 0,
            authority: Pubkey::new_unique(),
            target_program: Pubkey::new_unique(),
            session_signer: Pubkey::new_unique(),
            valid_until: 1000,
        };

        assert!(!session.is_expired(999));
        assert!(!session.is_expired(1000));
        assert!(session.is_expired(1001));
    }

    #[test]
    fn test_find_address_deterministic() {
        let authority = Pubkey::new_unique();
        let target_program = Pubkey::new_unique();
        let session_signer = Pubkey::new_unique();
        let session_program = Pubkey::new_unique();

        let (addr1, bump1) =
            SessionToken::find_address(&target_program, &session_signer, &authority, &session_program);
        let (addr2, bump2) =
            SessionToken::find_address(&target_program, &session_signer, &authority, &session_program);

        assert_eq!(addr1, addr2);
        assert_eq!(bump1, bump2);
    }

    #[test]
    fn test_different_inputs_different_addresses() {
        let authority1 = Pubkey::new_unique();
        let authority2 = Pubkey::new_unique();
        let target_program = Pubkey::new_unique();
        let session_signer = Pubkey::new_unique();
        let session_program = Pubkey::new_unique();

        let (addr1, _) =
            SessionToken::find_address(&target_program, &session_signer, &authority1, &session_program);
        let (addr2, _) =
            SessionToken::find_address(&target_program, &session_signer, &authority2, &session_program);

        assert_ne!(addr1, addr2);
    }

    #[test]
    fn test_session_error_codes() {
        // Verify error codes don't overlap with common Solana errors
        let error: ProgramError = SessionError::InvalidToken.into();
        if let ProgramError::Custom(code) = error {
            assert!(code >= 6000);
        } else {
            panic!("Expected Custom error");
        }
    }
}

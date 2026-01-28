use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum RetroError {
    #[error("Only the facilitator can perform this action")]
    UnauthorizedFacilitator,

    #[error("Board is closed and cannot be modified")]
    BoardClosed,

    #[error("Invalid stage for this operation")]
    InvalidStage,

    #[error("Cannot advance to the requested stage")]
    InvalidStageTransition,

    #[error("Participant is not on the allowlist")]
    NotOnAllowlist,

    #[error("Maximum number of participants in allowlist reached")]
    MaxParticipantsReached,

    #[error("Invalid category ID")]
    InvalidCategoryId,

    #[error("Note content exceeds maximum length")]
    NoteTooLong,

    #[error("Group title exceeds maximum length")]
    GroupTitleTooLong,

    #[error("Note is already assigned to a group")]
    NoteAlreadyGrouped,

    #[error("Note is not assigned to any group")]
    NoteNotGrouped,

    #[error("Insufficient voting credits")]
    InsufficientCredits,

    #[error("Vote credits can only be increased, not decreased")]
    CannotDecreaseVotes,

    #[error("Too many categories specified")]
    TooManyCategories,

    #[error("Category name is too long")]
    CategoryNameTooLong,

    #[error("At least one category is required")]
    NoCategoriesSpecified,

    #[error("Invalid PDA derivation")]
    InvalidPDA,

    #[error("Account not initialized")]
    AccountNotInitialized,

    #[error("Account already initialized")]
    AccountAlreadyInitialized,

    #[error("Invalid account owner")]
    InvalidAccountOwner,

    #[error("Action item description exceeds maximum length")]
    ActionDescriptionTooLong,

    #[error("Too many verifiers specified")]
    TooManyVerifiers,

    #[error("Owner cannot be a verifier of their own action item")]
    OwnerCannotVerify,

    #[error("Verification threshold must be at least 1")]
    ThresholdTooLow,

    #[error("Verification threshold exceeds number of verifiers")]
    ThresholdTooHigh,

    #[error("Not a designated verifier for this action item")]
    NotAVerifier,

    #[error("Action item is not pending verification")]
    ActionItemNotPending,

    #[error("Already voted on this action item")]
    AlreadyVoted,

    #[error("Board must be closed before verification can occur")]
    BoardNotClosed,

    #[error("Session validity exceeds maximum (7 days)")]
    SessionValidityTooLong,

    #[error("Session has already expired")]
    SessionAlreadyExpired,

    #[error("Only the session authority can revoke the session")]
    UnauthorizedSessionRevoke,
}

impl From<RetroError> for ProgramError {
    fn from(e: RetroError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

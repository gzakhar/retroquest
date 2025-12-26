use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum RetroError {
    #[error("Only the facilitator can perform this action")]
    UnauthorizedFacilitator,

    #[error("Only the team authority can perform this action")]
    UnauthorizedTeamAuthority,

    #[error("Session is closed and cannot be modified")]
    SessionClosed,

    #[error("Invalid stage for this operation")]
    InvalidStage,

    #[error("Cannot advance to the requested stage")]
    InvalidStageTransition,

    #[error("Participant is not on the allowlist")]
    NotOnAllowlist,

    #[error("Participant has already joined the session")]
    AlreadyJoined,

    #[error("Participant has not joined the session")]
    NotJoined,

    #[error("Maximum number of participants reached")]
    MaxParticipantsReached,

    #[error("Maximum number of notes per participant reached")]
    MaxNotesReached,

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

    #[error("Open join is not enabled for this session")]
    OpenJoinDisabled,

    #[error("Allowlist is not enabled for this session")]
    AllowlistDisabled,

    #[error("Invalid PDA derivation")]
    InvalidPDA,

    #[error("Account not initialized")]
    AccountNotInitialized,

    #[error("Account already initialized")]
    AccountAlreadyInitialized,

    #[error("Invalid account owner")]
    InvalidAccountOwner,
}

impl From<RetroError> for ProgramError {
    fn from(e: RetroError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

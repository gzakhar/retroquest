use anchor_lang::prelude::*;

#[error_code]
pub enum RetroError {
    #[msg("Only the facilitator can perform this action")]
    UnauthorizedFacilitator,

    #[msg("Only the team authority can perform this action")]
    UnauthorizedTeamAuthority,

    #[msg("Session is closed and cannot be modified")]
    SessionClosed,

    #[msg("Invalid stage for this operation")]
    InvalidStage,

    #[msg("Cannot advance to the requested stage")]
    InvalidStageTransition,

    #[msg("Participant is not on the allowlist")]
    NotOnAllowlist,

    #[msg("Participant has already joined the session")]
    AlreadyJoined,

    #[msg("Participant has not joined the session")]
    NotJoined,

    #[msg("Maximum number of participants reached")]
    MaxParticipantsReached,

    #[msg("Maximum number of notes per participant reached")]
    MaxNotesReached,

    #[msg("Invalid category ID")]
    InvalidCategoryId,

    #[msg("Note content exceeds maximum length")]
    NoteTooLong,

    #[msg("Group title exceeds maximum length")]
    GroupTitleTooLong,

    #[msg("Note is already assigned to a group")]
    NoteAlreadyGrouped,

    #[msg("Note is not assigned to any group")]
    NoteNotGrouped,

    #[msg("Insufficient voting credits")]
    InsufficientCredits,

    #[msg("Vote credits can only be increased, not decreased")]
    CannotDecreaseVotes,

    #[msg("Too many categories specified")]
    TooManyCategories,

    #[msg("Category name is too long")]
    CategoryNameTooLong,

    #[msg("At least one category is required")]
    NoCategoriesSpecified,

    #[msg("Open join is not enabled for this session")]
    OpenJoinDisabled,

    #[msg("Allowlist is not enabled for this session")]
    AllowlistDisabled,

    #[msg("Session has not started yet")]
    SessionNotStarted,
}

use anchor_lang::prelude::*;

declare_id!("RQst1111111111111111111111111111111111111111");

// ============================================================================
// Constants
// ============================================================================

pub const MAX_NOTE_CHARS: usize = 280;
pub const MAX_GROUP_TITLE_CHARS: usize = 80;
pub const MAX_PARTICIPANTS: u32 = 30;
pub const MAX_NOTES_PER_PARTICIPANT: u8 = 10;
pub const MAX_CATEGORIES: usize = 5;
pub const MAX_CATEGORY_NAME_LEN: usize = 32;
pub const VOTING_CREDITS_DEFAULT: u8 = 5;

// ============================================================================
// Errors
// ============================================================================

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
}

// ============================================================================
// State: Account Structures
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct TeamRegistry {
    pub team_authority: Pubkey,
    pub session_count: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
#[repr(u8)]
pub enum SessionStage {
    Setup = 0,
    WriteNotes = 1,
    GroupDuplicates = 2,
    Vote = 3,
    Discuss = 4,
}

impl SessionStage {
    pub fn can_advance_to(&self, next: SessionStage) -> bool {
        let current = *self as u8;
        let target = next as u8;
        target == current + 1
    }
}

#[account]
#[derive(InitSpace)]
pub struct RetroSession {
    pub team_authority: Pubkey,
    pub facilitator: Pubkey,
    pub session_index: u64,
    pub stage: SessionStage,
    pub closed: bool,
    #[max_len(MAX_CATEGORIES, MAX_CATEGORY_NAME_LEN)]
    pub categories: Vec<String>,
    pub max_notes_per_participant: u8,
    pub voting_credits_per_participant: u8,
    pub allowlist_enabled: bool,
    pub open_join: bool,
    pub participant_count: u32,
    pub note_count: u64,
    pub group_count: u64,
    pub created_at_slot: u64,
    pub stage_changed_at_slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ParticipantEntry {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub joined: bool,
    pub notes_submitted: u8,
    pub credits_spent: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AllowlistEntry {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub allowed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Note {
    pub session: Pubkey,
    pub note_id: u64,
    pub author: Pubkey,
    pub category_id: u8,
    #[max_len(MAX_NOTE_CHARS)]
    pub content: String,
    pub created_at_slot: u64,
    pub group_id: Option<u64>,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Group {
    pub session: Pubkey,
    pub group_id: u64,
    #[max_len(MAX_GROUP_TITLE_CHARS)]
    pub title: String,
    pub created_by: Pubkey,
    pub vote_tally: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub group_id: u64,
    pub credits_spent: u8,
    pub bump: u8,
}

// ============================================================================
// Instruction Args
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SessionConfig {
    pub categories: Vec<String>,
    pub max_notes_per_participant: Option<u8>,
    pub voting_credits_per_participant: Option<u8>,
    pub allowlist_enabled: bool,
    pub open_join: bool,
}

// ============================================================================
// Account Contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitTeamRegistry<'info> {
    #[account(
        init,
        payer = team_authority,
        space = 8 + TeamRegistry::INIT_SPACE,
        seeds = [b"team_registry", team_authority.key().as_ref()],
        bump
    )]
    pub team_registry: Account<'info, TeamRegistry>,
    #[account(mut)]
    pub team_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateSession<'info> {
    #[account(
        mut,
        seeds = [b"team_registry", team_authority.key().as_ref()],
        bump = team_registry.bump,
        has_one = team_authority @ RetroError::UnauthorizedTeamAuthority
    )]
    pub team_registry: Account<'info, TeamRegistry>,
    #[account(
        init,
        payer = team_authority,
        space = 8 + RetroSession::INIT_SPACE,
        seeds = [
            b"session",
            team_authority.key().as_ref(),
            team_registry.session_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub session: Account<'info, RetroSession>,
    #[account(mut)]
    pub team_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdvanceStage<'info> {
    #[account(
        mut,
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,
    pub facilitator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(
        mut,
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,
    pub facilitator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(participant_pubkey: Pubkey)]
pub struct AddToAllowlist<'info> {
    #[account(
        mut,
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,
    #[account(
        init,
        payer = facilitator,
        space = 8 + AllowlistEntry::INIT_SPACE,
        seeds = [b"allowlist", session.key().as_ref(), participant_pubkey.as_ref()],
        bump
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,
    #[account(mut)]
    pub facilitator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(participant_pubkey: Pubkey)]
pub struct RemoveFromAllowlist<'info> {
    #[account(has_one = facilitator @ RetroError::UnauthorizedFacilitator)]
    pub session: Account<'info, RetroSession>,
    #[account(
        mut,
        seeds = [b"allowlist", session.key().as_ref(), participant_pubkey.as_ref()],
        bump = allowlist_entry.bump,
        close = facilitator
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,
    #[account(mut)]
    pub facilitator: Signer<'info>,
}

#[derive(Accounts)]
pub struct JoinSessionWithAllowlist<'info> {
    #[account(mut)]
    pub session: Account<'info, RetroSession>,
    #[account(
        seeds = [b"allowlist", session.key().as_ref(), participant.key().as_ref()],
        bump = allowlist_entry.bump,
        constraint = allowlist_entry.allowed @ RetroError::NotOnAllowlist
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,
    #[account(
        init,
        payer = participant,
        space = 8 + ParticipantEntry::INIT_SPACE,
        seeds = [b"participant", session.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(mut)]
    pub participant: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinSessionOpen<'info> {
    #[account(
        mut,
        constraint = session.open_join @ RetroError::OpenJoinDisabled
    )]
    pub session: Account<'info, RetroSession>,
    #[account(
        init,
        payer = participant,
        space = 8 + ParticipantEntry::INIT_SPACE,
        seeds = [b"participant", session.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(mut)]
    pub participant: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(category_id: u8, content: String)]
pub struct CreateNote<'info> {
    #[account(
        mut,
        constraint = session.stage == SessionStage::WriteNotes @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,
    #[account(
        mut,
        seeds = [b"participant", session.key().as_ref(), author.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        init,
        payer = author,
        space = 8 + Note::INIT_SPACE,
        seeds = [b"note", session.key().as_ref(), session.note_count.to_le_bytes().as_ref()],
        bump
    )]
    pub note: Account<'info, Note>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateGroup<'info> {
    #[account(
        mut,
        constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,
    #[account(
        seeds = [b"participant", session.key().as_ref(), creator.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        init,
        payer = creator,
        space = 8 + Group::INIT_SPACE,
        seeds = [b"group", session.key().as_ref(), session.group_count.to_le_bytes().as_ref()],
        bump
    )]
    pub group: Account<'info, Group>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(group_id: u64, title: String)]
pub struct SetGroupTitle<'info> {
    #[account(constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage)]
    pub session: Account<'info, RetroSession>,
    #[account(
        seeds = [b"participant", session.key().as_ref(), participant.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        mut,
        seeds = [b"group", session.key().as_ref(), group_id.to_le_bytes().as_ref()],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(note_id: u64, group_id: u64)]
pub struct AssignNoteToGroup<'info> {
    #[account(constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage)]
    pub session: Account<'info, RetroSession>,
    #[account(
        seeds = [b"participant", session.key().as_ref(), participant.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        mut,
        seeds = [b"note", session.key().as_ref(), note_id.to_le_bytes().as_ref()],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,
    #[account(
        seeds = [b"group", session.key().as_ref(), group_id.to_le_bytes().as_ref()],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(note_id: u64)]
pub struct UnassignNote<'info> {
    #[account(constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage)]
    pub session: Account<'info, RetroSession>,
    #[account(
        seeds = [b"participant", session.key().as_ref(), participant.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        mut,
        seeds = [b"note", session.key().as_ref(), note_id.to_le_bytes().as_ref()],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CastVote<'info> {
    #[account(constraint = session.stage == SessionStage::Vote @ RetroError::InvalidStage)]
    pub session: Account<'info, RetroSession>,
    #[account(
        mut,
        seeds = [b"participant", session.key().as_ref(), voter.key().as_ref()],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,
    #[account(
        mut,
        seeds = [b"group", session.key().as_ref(), group_id.to_le_bytes().as_ref()],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [b"vote", session.key().as_ref(), voter.key().as_ref(), group_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Program
// ============================================================================

#[program]
pub mod retroquest {
    use super::*;

    pub fn init_team_registry(ctx: Context<InitTeamRegistry>) -> Result<()> {
        let team_registry = &mut ctx.accounts.team_registry;
        team_registry.team_authority = ctx.accounts.team_authority.key();
        team_registry.session_count = 0;
        team_registry.bump = ctx.bumps.team_registry;
        Ok(())
    }

    pub fn create_session(ctx: Context<CreateSession>, config: SessionConfig) -> Result<()> {
        require!(!config.categories.is_empty(), RetroError::NoCategoriesSpecified);
        require!(config.categories.len() <= MAX_CATEGORIES, RetroError::TooManyCategories);

        for category in &config.categories {
            require!(category.len() <= MAX_CATEGORY_NAME_LEN, RetroError::CategoryNameTooLong);
        }

        let session = &mut ctx.accounts.session;
        let team_registry = &mut ctx.accounts.team_registry;
        let clock = Clock::get()?;

        session.team_authority = ctx.accounts.team_authority.key();
        session.facilitator = ctx.accounts.team_authority.key();
        session.session_index = team_registry.session_count;
        session.stage = SessionStage::Setup;
        session.closed = false;
        session.categories = config.categories;
        session.max_notes_per_participant = config.max_notes_per_participant.unwrap_or(MAX_NOTES_PER_PARTICIPANT);
        session.voting_credits_per_participant = config.voting_credits_per_participant.unwrap_or(VOTING_CREDITS_DEFAULT);
        session.allowlist_enabled = config.allowlist_enabled;
        session.open_join = config.open_join;
        session.participant_count = 0;
        session.note_count = 0;
        session.group_count = 0;
        session.created_at_slot = clock.slot;
        session.stage_changed_at_slot = clock.slot;
        session.bump = ctx.bumps.session;

        team_registry.session_count += 1;

        Ok(())
    }

    pub fn advance_stage(ctx: Context<AdvanceStage>, new_stage: SessionStage) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.stage.can_advance_to(new_stage), RetroError::InvalidStageTransition);

        let clock = Clock::get()?;
        session.stage = new_stage;
        session.stage_changed_at_slot = clock.slot;
        Ok(())
    }

    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.stage == SessionStage::Discuss, RetroError::InvalidStage);
        session.closed = true;
        Ok(())
    }

    pub fn add_to_allowlist(ctx: Context<AddToAllowlist>, participant_pubkey: Pubkey) -> Result<()> {
        let session = &ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.stage == SessionStage::Setup, RetroError::InvalidStage);
        require!(session.allowlist_enabled, RetroError::AllowlistDisabled);

        let allowlist_entry = &mut ctx.accounts.allowlist_entry;
        allowlist_entry.session = session.key();
        allowlist_entry.participant = participant_pubkey;
        allowlist_entry.allowed = true;
        allowlist_entry.bump = ctx.bumps.allowlist_entry;
        Ok(())
    }

    pub fn remove_from_allowlist(ctx: Context<RemoveFromAllowlist>, _participant_pubkey: Pubkey) -> Result<()> {
        let session = &ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.stage == SessionStage::Setup, RetroError::InvalidStage);
        require!(session.allowlist_enabled, RetroError::AllowlistDisabled);
        Ok(())
    }

    pub fn join_session_with_allowlist(ctx: Context<JoinSessionWithAllowlist>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.allowlist_enabled, RetroError::AllowlistDisabled);
        require!(session.participant_count < MAX_PARTICIPANTS, RetroError::MaxParticipantsReached);

        let participant_entry = &mut ctx.accounts.participant_entry;
        participant_entry.session = session.key();
        participant_entry.participant = ctx.accounts.participant.key();
        participant_entry.joined = true;
        participant_entry.notes_submitted = 0;
        participant_entry.credits_spent = 0;
        participant_entry.bump = ctx.bumps.participant_entry;

        session.participant_count += 1;
        Ok(())
    }

    pub fn join_session_open(ctx: Context<JoinSessionOpen>) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(session.participant_count < MAX_PARTICIPANTS, RetroError::MaxParticipantsReached);

        let participant_entry = &mut ctx.accounts.participant_entry;
        participant_entry.session = session.key();
        participant_entry.participant = ctx.accounts.participant.key();
        participant_entry.joined = true;
        participant_entry.notes_submitted = 0;
        participant_entry.credits_spent = 0;
        participant_entry.bump = ctx.bumps.participant_entry;

        session.participant_count += 1;
        Ok(())
    }

    pub fn create_note(ctx: Context<CreateNote>, category_id: u8, content: String) -> Result<()> {
        let session = &mut ctx.accounts.session;
        let participant_entry = &mut ctx.accounts.participant_entry;

        require!(!session.closed, RetroError::SessionClosed);
        require!(content.len() <= MAX_NOTE_CHARS, RetroError::NoteTooLong);
        require!((category_id as usize) < session.categories.len(), RetroError::InvalidCategoryId);
        require!(
            participant_entry.notes_submitted < session.max_notes_per_participant,
            RetroError::MaxNotesReached
        );

        let clock = Clock::get()?;
        let note = &mut ctx.accounts.note;

        note.session = session.key();
        note.note_id = session.note_count;
        note.author = ctx.accounts.author.key();
        note.category_id = category_id;
        note.content = content;
        note.created_at_slot = clock.slot;
        note.group_id = None;
        note.bump = ctx.bumps.note;

        participant_entry.notes_submitted += 1;
        session.note_count += 1;
        Ok(())
    }

    pub fn create_group(ctx: Context<CreateGroup>, title: String) -> Result<()> {
        let session = &mut ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(title.len() <= MAX_GROUP_TITLE_CHARS, RetroError::GroupTitleTooLong);

        let group = &mut ctx.accounts.group;
        group.session = session.key();
        group.group_id = session.group_count;
        group.title = title;
        group.created_by = ctx.accounts.creator.key();
        group.vote_tally = 0;
        group.bump = ctx.bumps.group;

        session.group_count += 1;
        Ok(())
    }

    pub fn set_group_title(ctx: Context<SetGroupTitle>, _group_id: u64, title: String) -> Result<()> {
        let session = &ctx.accounts.session;
        require!(!session.closed, RetroError::SessionClosed);
        require!(title.len() <= MAX_GROUP_TITLE_CHARS, RetroError::GroupTitleTooLong);

        let group = &mut ctx.accounts.group;
        group.title = title;
        Ok(())
    }

    pub fn assign_note_to_group(ctx: Context<AssignNoteToGroup>, _note_id: u64, group_id: u64) -> Result<()> {
        let session = &ctx.accounts.session;
        let note = &mut ctx.accounts.note;

        require!(!session.closed, RetroError::SessionClosed);
        require!(note.group_id.is_none(), RetroError::NoteAlreadyGrouped);

        note.group_id = Some(group_id);
        Ok(())
    }

    pub fn unassign_note(ctx: Context<UnassignNote>, _note_id: u64) -> Result<()> {
        let session = &ctx.accounts.session;
        let note = &mut ctx.accounts.note;

        require!(!session.closed, RetroError::SessionClosed);
        require!(note.group_id.is_some(), RetroError::NoteNotGrouped);

        note.group_id = None;
        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, group_id: u64, credits_delta: u8) -> Result<()> {
        let session = &ctx.accounts.session;
        let participant_entry = &mut ctx.accounts.participant_entry;
        let group = &mut ctx.accounts.group;
        let vote_record = &mut ctx.accounts.vote_record;

        require!(!session.closed, RetroError::SessionClosed);
        require!(credits_delta > 0, RetroError::CannotDecreaseVotes);

        let total_credits_after = participant_entry.credits_spent.checked_add(credits_delta)
            .ok_or(RetroError::InsufficientCredits)?;

        require!(
            total_credits_after <= session.voting_credits_per_participant,
            RetroError::InsufficientCredits
        );

        // Initialize vote record if new
        if vote_record.session == Pubkey::default() {
            vote_record.session = session.key();
            vote_record.participant = ctx.accounts.voter.key();
            vote_record.group_id = group_id;
            vote_record.credits_spent = 0;
            vote_record.bump = ctx.bumps.vote_record;
        }

        vote_record.credits_spent = vote_record.credits_spent.checked_add(credits_delta)
            .ok_or(RetroError::InsufficientCredits)?;
        participant_entry.credits_spent = total_credits_after;
        group.vote_tally = group.vote_tally.checked_add(credits_delta as u64)
            .ok_or(RetroError::InsufficientCredits)?;

        Ok(())
    }
}

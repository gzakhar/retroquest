use anchor_lang::prelude::*;
use crate::state::{TeamRegistry, RetroSession, SessionStage};
use crate::error::RetroError;
use crate::constants::{MAX_CATEGORIES, MAX_CATEGORY_NAME_LEN, VOTING_CREDITS_DEFAULT, MAX_NOTES_PER_PARTICIPANT};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SessionConfig {
    pub categories: Vec<String>,
    pub max_notes_per_participant: Option<u8>,
    pub voting_credits_per_participant: Option<u8>,
    pub allowlist_enabled: bool,
    pub open_join: bool,
}

#[derive(Accounts)]
pub struct CreateSession<'info> {
    #[account(
        mut,
        seeds = [TeamRegistry::SEED_PREFIX, team_authority.key().as_ref()],
        bump = team_registry.bump,
        has_one = team_authority @ RetroError::UnauthorizedTeamAuthority
    )]
    pub team_registry: Account<'info, TeamRegistry>,

    #[account(
        init,
        payer = team_authority,
        space = 8 + RetroSession::INIT_SPACE,
        seeds = [
            RetroSession::SEED_PREFIX,
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

#[derive(Accounts)]
pub struct AdvanceStage<'info> {
    #[account(
        mut,
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,

    pub facilitator: Signer<'info>,
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

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(
        mut,
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,

    pub facilitator: Signer<'info>,
}

pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
    let session = &mut ctx.accounts.session;

    require!(!session.closed, RetroError::SessionClosed);
    require!(session.stage == SessionStage::Discuss, RetroError::InvalidStage);

    session.closed = true;

    Ok(())
}

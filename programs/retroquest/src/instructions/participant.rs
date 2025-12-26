use anchor_lang::prelude::*;
use crate::state::{RetroSession, ParticipantEntry, AllowlistEntry, SessionStage};
use crate::error::RetroError;
use crate::constants::MAX_PARTICIPANTS;

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
        seeds = [
            AllowlistEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant_pubkey.as_ref()
        ],
        bump
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,

    #[account(mut)]
    pub facilitator: Signer<'info>,

    pub system_program: Program<'info, System>,
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

#[derive(Accounts)]
#[instruction(participant_pubkey: Pubkey)]
pub struct RemoveFromAllowlist<'info> {
    #[account(
        has_one = facilitator @ RetroError::UnauthorizedFacilitator
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        mut,
        seeds = [
            AllowlistEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant_pubkey.as_ref()
        ],
        bump = allowlist_entry.bump,
        close = facilitator
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,

    #[account(mut)]
    pub facilitator: Signer<'info>,
}

pub fn remove_from_allowlist(ctx: Context<RemoveFromAllowlist>, _participant_pubkey: Pubkey) -> Result<()> {
    let session = &ctx.accounts.session;

    require!(!session.closed, RetroError::SessionClosed);
    require!(session.stage == SessionStage::Setup, RetroError::InvalidStage);
    require!(session.allowlist_enabled, RetroError::AllowlistDisabled);

    Ok(())
}

#[derive(Accounts)]
pub struct JoinSessionWithAllowlist<'info> {
    #[account(mut)]
    pub session: Account<'info, RetroSession>,

    #[account(
        seeds = [
            AllowlistEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
        ],
        bump = allowlist_entry.bump,
        constraint = allowlist_entry.allowed @ RetroError::NotOnAllowlist
    )]
    pub allowlist_entry: Account<'info, AllowlistEntry>,

    #[account(
        init,
        payer = participant,
        space = 8 + ParticipantEntry::INIT_SPACE,
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
        ],
        bump
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(mut)]
    pub participant: Signer<'info>,

    pub system_program: Program<'info, System>,
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
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
        ],
        bump
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(mut)]
    pub participant: Signer<'info>,

    pub system_program: Program<'info, System>,
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

use anchor_lang::prelude::*;
use crate::state::{RetroSession, ParticipantEntry, Group, VoteRecord, SessionStage};
use crate::error::RetroError;

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CastVote<'info> {
    #[account(
        constraint = session.stage == SessionStage::Vote @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        mut,
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            voter.key().as_ref()
        ],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(
        mut,
        seeds = [
            Group::SEED_PREFIX,
            session.key().as_ref(),
            group_id.to_le_bytes().as_ref()
        ],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,

    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + VoteRecord::INIT_SPACE,
        seeds = [
            VoteRecord::SEED_PREFIX,
            session.key().as_ref(),
            voter.key().as_ref(),
            group_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
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

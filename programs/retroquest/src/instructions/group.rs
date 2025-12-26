use anchor_lang::prelude::*;
use crate::state::{RetroSession, ParticipantEntry, Group, Note, SessionStage};
use crate::error::RetroError;
use crate::constants::MAX_GROUP_TITLE_CHARS;

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateGroup<'info> {
    #[account(
        mut,
        constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            creator.key().as_ref()
        ],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(
        init,
        payer = creator,
        space = 8 + Group::INIT_SPACE,
        seeds = [
            Group::SEED_PREFIX,
            session.key().as_ref(),
            session.group_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub group: Account<'info, Group>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
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

#[derive(Accounts)]
#[instruction(group_id: u64, title: String)]
pub struct SetGroupTitle<'info> {
    #[account(
        constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
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

    pub participant: Signer<'info>,
}

pub fn set_group_title(ctx: Context<SetGroupTitle>, _group_id: u64, title: String) -> Result<()> {
    let session = &ctx.accounts.session;

    require!(!session.closed, RetroError::SessionClosed);
    require!(title.len() <= MAX_GROUP_TITLE_CHARS, RetroError::GroupTitleTooLong);

    let group = &mut ctx.accounts.group;
    group.title = title;

    Ok(())
}

#[derive(Accounts)]
#[instruction(note_id: u64, group_id: u64)]
pub struct AssignNoteToGroup<'info> {
    #[account(
        constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
        ],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(
        mut,
        seeds = [
            Note::SEED_PREFIX,
            session.key().as_ref(),
            note_id.to_le_bytes().as_ref()
        ],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,

    #[account(
        seeds = [
            Group::SEED_PREFIX,
            session.key().as_ref(),
            group_id.to_le_bytes().as_ref()
        ],
        bump = group.bump
    )]
    pub group: Account<'info, Group>,

    pub participant: Signer<'info>,
}

pub fn assign_note_to_group(ctx: Context<AssignNoteToGroup>, _note_id: u64, group_id: u64) -> Result<()> {
    let session = &ctx.accounts.session;
    let note = &mut ctx.accounts.note;

    require!(!session.closed, RetroError::SessionClosed);
    require!(note.group_id.is_none(), RetroError::NoteAlreadyGrouped);

    note.group_id = Some(group_id);

    Ok(())
}

#[derive(Accounts)]
#[instruction(note_id: u64)]
pub struct UnassignNote<'info> {
    #[account(
        constraint = session.stage == SessionStage::GroupDuplicates @ RetroError::InvalidStage
    )]
    pub session: Account<'info, RetroSession>,

    #[account(
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            participant.key().as_ref()
        ],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(
        mut,
        seeds = [
            Note::SEED_PREFIX,
            session.key().as_ref(),
            note_id.to_le_bytes().as_ref()
        ],
        bump = note.bump
    )]
    pub note: Account<'info, Note>,

    pub participant: Signer<'info>,
}

pub fn unassign_note(ctx: Context<UnassignNote>, _note_id: u64) -> Result<()> {
    let session = &ctx.accounts.session;
    let note = &mut ctx.accounts.note;

    require!(!session.closed, RetroError::SessionClosed);
    require!(note.group_id.is_some(), RetroError::NoteNotGrouped);

    note.group_id = None;

    Ok(())
}

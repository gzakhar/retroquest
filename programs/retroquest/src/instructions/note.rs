use anchor_lang::prelude::*;
use crate::state::{RetroSession, ParticipantEntry, Note, SessionStage};
use crate::error::RetroError;
use crate::constants::MAX_NOTE_CHARS;

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
        seeds = [
            ParticipantEntry::SEED_PREFIX,
            session.key().as_ref(),
            author.key().as_ref()
        ],
        bump = participant_entry.bump,
        constraint = participant_entry.joined @ RetroError::NotJoined
    )]
    pub participant_entry: Account<'info, ParticipantEntry>,

    #[account(
        init,
        payer = author,
        space = 8 + Note::INIT_SPACE,
        seeds = [
            Note::SEED_PREFIX,
            session.key().as_ref(),
            session.note_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub note: Account<'info, Note>,

    #[account(mut)]
    pub author: Signer<'info>,

    pub system_program: Program<'info, System>,
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

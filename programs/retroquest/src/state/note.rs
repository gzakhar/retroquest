use anchor_lang::prelude::*;
use crate::constants::MAX_NOTE_CHARS;

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

impl Note {
    pub const SEED_PREFIX: &'static [u8] = b"note";
}

use anchor_lang::prelude::*;
use crate::constants::{MAX_CATEGORIES, MAX_CATEGORY_NAME_LEN};

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

impl RetroSession {
    pub const SEED_PREFIX: &'static [u8] = b"session";
}

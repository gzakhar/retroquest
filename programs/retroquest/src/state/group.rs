use anchor_lang::prelude::*;
use crate::constants::MAX_GROUP_TITLE_CHARS;

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

impl Group {
    pub const SEED_PREFIX: &'static [u8] = b"group";
}

use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct TeamRegistry {
    pub team_authority: Pubkey,
    pub session_count: u64,
    pub bump: u8,
}

impl TeamRegistry {
    pub const SEED_PREFIX: &'static [u8] = b"team_registry";
}

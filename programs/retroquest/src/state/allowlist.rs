use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct AllowlistEntry {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub allowed: bool,
    pub bump: u8,
}

impl AllowlistEntry {
    pub const SEED_PREFIX: &'static [u8] = b"allowlist";
}

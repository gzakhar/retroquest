use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub group_id: u64,
    pub credits_spent: u8,
    pub bump: u8,
}

impl VoteRecord {
    pub const SEED_PREFIX: &'static [u8] = b"vote";
}

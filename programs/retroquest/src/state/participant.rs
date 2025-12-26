use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ParticipantEntry {
    pub session: Pubkey,
    pub participant: Pubkey,
    pub joined: bool,
    pub notes_submitted: u8,
    pub credits_spent: u8,
    pub bump: u8,
}

impl ParticipantEntry {
    pub const SEED_PREFIX: &'static [u8] = b"participant";
}

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

// Constants
pub const MAX_NOTE_CHARS: usize = 280;
pub const MAX_GROUP_TITLE_CHARS: usize = 80;
pub const MAX_PARTICIPANTS: usize = 8;
pub const MAX_CATEGORIES: usize = 5;
pub const MAX_CATEGORY_NAME_LEN: usize = 32;
pub const VOTING_CREDITS_DEFAULT: u8 = 5;

// PDA Seeds
pub const TEAM_REGISTRY_SEED: &[u8] = b"team_registry";
pub const SESSION_SEED: &[u8] = b"session";
pub const PARTICIPANT_SEED: &[u8] = b"participant";
pub const NOTE_SEED: &[u8] = b"note";
pub const GROUP_SEED: &[u8] = b"group";
pub const VOTE_SEED: &[u8] = b"vote";

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
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

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct TeamRegistry {
    pub is_initialized: bool,
    pub team_authority: Pubkey,
    pub session_count: u64,
    pub bump: u8,
}

impl TeamRegistry {
    pub const LEN: usize = 1 + 32 + 8 + 1;
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct RetroSession {
    pub is_initialized: bool,
    pub team_authority: Pubkey,
    pub facilitator: Pubkey,
    pub session_index: u64,
    pub stage: SessionStage,
    pub closed: bool,
    pub categories: Vec<String>,
    pub allowlist: Vec<Pubkey>,
    pub voting_credits_per_participant: u8,
    pub note_count: u64,
    pub group_count: u64,
    pub created_at_slot: u64,
    pub stage_changed_at_slot: u64,
    pub bump: u8,
}

impl RetroSession {
    // Base size without dynamic Vecs
    // is_initialized(1) + team_authority(32) + facilitator(32) + session_index(8) +
    // stage(1) + closed(1) + voting_credits(1) +
    // note_count(8) + group_count(8) + created_at_slot(8) + stage_changed_at_slot(8) + bump(1)
    pub const BASE_LEN: usize = 1 + 32 + 32 + 8 + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 1;

    // Categories: vec_len(4) + MAX_CATEGORIES * (str_len(4) + MAX_CATEGORY_NAME_LEN)
    pub const CATEGORIES_LEN: usize = 4 + (MAX_CATEGORIES * (4 + MAX_CATEGORY_NAME_LEN));

    // Allowlist: vec_len(4) + MAX_PARTICIPANTS * pubkey(32)
    pub const ALLOWLIST_LEN: usize = 4 + (MAX_PARTICIPANTS * 32);

    pub const MAX_LEN: usize = Self::BASE_LEN + Self::CATEGORIES_LEN + Self::ALLOWLIST_LEN;
}

/// ParticipantEntry tracks voting credits spent per participant.
/// Created lazily on first vote.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct ParticipantEntry {
    pub is_initialized: bool,
    pub session: Pubkey,
    pub participant: Pubkey,
    pub credits_spent: u8,
    pub bump: u8,
}

impl ParticipantEntry {
    pub const LEN: usize = 1 + 32 + 32 + 1 + 1;
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Note {
    pub is_initialized: bool,
    pub session: Pubkey,
    pub note_id: u64,
    pub author: Pubkey,
    pub category_id: u8,
    pub content: String,
    pub created_at_slot: u64,
    pub group_id: Option<u64>,
    pub bump: u8,
}

impl Note {
    pub const MAX_LEN: usize = 1 + 32 + 8 + 32 + 1 + (4 + MAX_NOTE_CHARS) + 8 + 9 + 1;
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct Group {
    pub is_initialized: bool,
    pub session: Pubkey,
    pub group_id: u64,
    pub title: String,
    pub created_by: Pubkey,
    pub vote_tally: u64,
    pub bump: u8,
}

impl Group {
    pub const MAX_LEN: usize = 1 + 32 + 8 + (4 + MAX_GROUP_TITLE_CHARS) + 32 + 8 + 1;
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub struct VoteRecord {
    pub is_initialized: bool,
    pub session: Pubkey,
    pub participant: Pubkey,
    pub group_id: u64,
    pub credits_spent: u8,
    pub bump: u8,
}

impl VoteRecord {
    pub const LEN: usize = 1 + 32 + 32 + 8 + 1 + 1;
}

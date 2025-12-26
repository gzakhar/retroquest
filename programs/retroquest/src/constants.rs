pub const MAX_NOTE_CHARS: usize = 280;
pub const MAX_GROUP_TITLE_CHARS: usize = 80;
pub const MAX_PARTICIPANTS: u32 = 30;
pub const MAX_NOTES_PER_PARTICIPANT: u8 = 10;
pub const MAX_CATEGORIES: usize = 5;
pub const MAX_CATEGORY_NAME_LEN: usize = 32;
pub const VOTING_CREDITS_DEFAULT: u8 = 5;

pub const TEAM_REGISTRY_SEED: &[u8] = b"team_registry";
pub const SESSION_SEED: &[u8] = b"session";
pub const PARTICIPANT_SEED: &[u8] = b"participant";
pub const ALLOWLIST_SEED: &[u8] = b"allowlist";
pub const NOTE_SEED: &[u8] = b"note";
pub const GROUP_SEED: &[u8] = b"group";
pub const VOTE_SEED: &[u8] = b"vote";

use borsh::BorshDeserialize;
use solana_program::{program_error::ProgramError, pubkey::Pubkey};

use crate::state::BoardStage;

// Instruction discriminators
pub const INIT_FACILITATOR_REGISTRY: u8 = 0;
pub const CREATE_BOARD: u8 = 1;
pub const ADVANCE_STAGE: u8 = 2;
pub const CLOSE_BOARD: u8 = 3;
pub const CREATE_NOTE: u8 = 4;
pub const CREATE_GROUP: u8 = 5;
pub const SET_GROUP_TITLE: u8 = 6;
pub const ASSIGN_NOTE_TO_GROUP: u8 = 7;
pub const UNASSIGN_NOTE: u8 = 8;
pub const CAST_VOTE: u8 = 9;
pub const CREATE_ACTION_ITEM: u8 = 10;
pub const CAST_VERIFICATION_VOTE: u8 = 11;

#[derive(Debug)]
pub enum RetroInstruction {
    /// Initialize a facilitator registry
    /// Accounts:
    /// 0. `[writable]` Facilitator registry PDA
    /// 1. `[signer]` Facilitator
    /// 2. `[]` System program
    InitFacilitatorRegistry,

    /// Create a new retro board
    /// Accounts:
    /// 0. `[writable]` Facilitator registry PDA
    /// 1. `[writable]` Board PDA
    /// 2. `[signer]` Facilitator
    /// 3. `[]` System program
    /// 4+ `[writable]` BoardMembership PDAs for each allowlist member
    CreateBoard {
        categories: Vec<String>,
        allowlist: Vec<Pubkey>,
        voting_credits_per_participant: Option<u8>,
    },

    /// Advance board to next stage
    /// Accounts:
    /// 0. `[writable]` Board PDA
    /// 1. `[signer]` Facilitator
    AdvanceStage { new_stage: BoardStage },

    /// Close the board
    /// Accounts:
    /// 0. `[writable]` Board PDA
    /// 1. `[signer]` Facilitator
    CloseBoard,

    /// Create a note (must be on allowlist)
    /// Accounts:
    /// 0. `[writable]` Board PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[signer]` Author
    /// 3. `[]` System program
    CreateNote { category_id: u8, content: String },

    /// Create a group (must be on allowlist)
    /// Accounts:
    /// 0. `[writable]` Board PDA
    /// 1. `[writable]` Group PDA
    /// 2. `[signer]` Creator
    /// 3. `[]` System program
    CreateGroup { title: String },

    /// Set group title (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Board PDA
    /// 1. `[writable]` Group PDA
    /// 2. `[signer]` Participant
    SetGroupTitle { group_id: u64, title: String },

    /// Assign note to group (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Board PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[]` Group PDA
    /// 3. `[signer]` Participant
    AssignNoteToGroup { note_id: u64, group_id: u64 },

    /// Unassign note from group (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Board PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[signer]` Participant
    UnassignNote { note_id: u64 },

    /// Cast vote (must be on allowlist)
    /// Uses BoardMembership to track credits
    /// Accounts:
    /// 0. `[]` Board PDA
    /// 1. `[writable]` BoardMembership PDA
    /// 2. `[writable]` Group PDA
    /// 3. `[writable]` Vote record PDA
    /// 4. `[signer]` Voter
    /// 5. `[]` System program
    CastVote { group_id: u64, credits_delta: u8 },

    /// Create an action item (facilitator only, Discuss stage)
    /// Accounts:
    /// 0. `[writable]` Board PDA
    /// 1. `[writable]` ActionItem PDA
    /// 2. `[signer]` Facilitator
    /// 3. `[]` System program
    CreateActionItem {
        description: String,
        owner: Pubkey,
        verifiers: Vec<Pubkey>,
        threshold: u8,
    },

    /// Cast a verification vote on an action item (board must be closed)
    /// Accounts:
    /// 0. `[]` Board PDA
    /// 1. `[writable]` ActionItem PDA
    /// 2. `[writable]` VerificationVote PDA
    /// 3. `[writable]` Owner's BoardMembership PDA (for score update)
    /// 4. `[signer]` Verifier
    /// 5. `[]` System program
    CastVerificationVote { action_item_id: u64, approved: bool },
}

// Instruction data payloads for Borsh deserialization
#[derive(BorshDeserialize)]
struct CreateBoardPayload {
    categories: Vec<String>,
    allowlist: Vec<Pubkey>,
    voting_credits_per_participant: Option<u8>,
}

#[derive(BorshDeserialize)]
struct AdvanceStagePayload {
    new_stage: u8,
}

#[derive(BorshDeserialize)]
struct CreateNotePayload {
    category_id: u8,
    content: String,
}

#[derive(BorshDeserialize)]
struct CreateGroupPayload {
    title: String,
}

#[derive(BorshDeserialize)]
struct SetGroupTitlePayload {
    group_id: u64,
    title: String,
}

#[derive(BorshDeserialize)]
struct AssignNotePayload {
    note_id: u64,
    group_id: u64,
}

#[derive(BorshDeserialize)]
struct UnassignNotePayload {
    note_id: u64,
}

#[derive(BorshDeserialize)]
struct CastVotePayload {
    group_id: u64,
    credits_delta: u8,
}

#[derive(BorshDeserialize)]
struct CreateActionItemPayload {
    description: String,
    owner: Pubkey,
    verifiers: Vec<Pubkey>,
    threshold: u8,
}

#[derive(BorshDeserialize)]
struct CastVerificationVotePayload {
    action_item_id: u64,
    approved: bool,
}

impl RetroInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        Ok(match variant {
            0 => Self::InitFacilitatorRegistry,

            1 => {
                let payload = CreateBoardPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateBoard {
                    categories: payload.categories,
                    allowlist: payload.allowlist,
                    voting_credits_per_participant: payload.voting_credits_per_participant,
                }
            }

            2 => {
                let payload = AdvanceStagePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let new_stage = match payload.new_stage {
                    0 => BoardStage::Setup,
                    1 => BoardStage::WriteNotes,
                    2 => BoardStage::GroupDuplicates,
                    3 => BoardStage::Vote,
                    4 => BoardStage::Discuss,
                    _ => return Err(ProgramError::InvalidInstructionData),
                };
                Self::AdvanceStage { new_stage }
            }

            3 => Self::CloseBoard,

            4 => {
                let payload = CreateNotePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateNote {
                    category_id: payload.category_id,
                    content: payload.content,
                }
            }

            5 => {
                let payload = CreateGroupPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateGroup {
                    title: payload.title,
                }
            }

            6 => {
                let payload = SetGroupTitlePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::SetGroupTitle {
                    group_id: payload.group_id,
                    title: payload.title,
                }
            }

            7 => {
                let payload = AssignNotePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::AssignNoteToGroup {
                    note_id: payload.note_id,
                    group_id: payload.group_id,
                }
            }

            8 => {
                let payload = UnassignNotePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::UnassignNote {
                    note_id: payload.note_id,
                }
            }

            9 => {
                let payload = CastVotePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CastVote {
                    group_id: payload.group_id,
                    credits_delta: payload.credits_delta,
                }
            }

            10 => {
                let payload = CreateActionItemPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateActionItem {
                    description: payload.description,
                    owner: payload.owner,
                    verifiers: payload.verifiers,
                    threshold: payload.threshold,
                }
            }

            11 => {
                let payload = CastVerificationVotePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CastVerificationVote {
                    action_item_id: payload.action_item_id,
                    approved: payload.approved,
                }
            }

            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

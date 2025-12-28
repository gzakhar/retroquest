use borsh::BorshDeserialize;
use solana_program::{program_error::ProgramError, pubkey::Pubkey};

use crate::state::SessionStage;

#[derive(Debug)]
pub enum RetroInstruction {
    /// Initialize a team registry
    /// Accounts:
    /// 0. `[writable]` Team registry PDA
    /// 1. `[signer]` Team authority
    /// 2. `[]` System program
    InitTeamRegistry,

    /// Create a new retro session
    /// Accounts:
    /// 0. `[writable]` Team registry PDA
    /// 1. `[writable]` Session PDA
    /// 2. `[signer]` Team authority
    /// 3. `[]` System program
    CreateSession {
        categories: Vec<String>,
        allowlist: Vec<Pubkey>,
        voting_credits_per_participant: Option<u8>,
    },

    /// Advance session to next stage
    /// Accounts:
    /// 0. `[writable]` Session PDA
    /// 1. `[signer]` Facilitator
    AdvanceStage { new_stage: SessionStage },

    /// Close the session
    /// Accounts:
    /// 0. `[writable]` Session PDA
    /// 1. `[signer]` Facilitator
    CloseSession,

    /// Create a note (must be on allowlist)
    /// Accounts:
    /// 0. `[writable]` Session PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[signer]` Author
    /// 3. `[]` System program
    CreateNote { category_id: u8, content: String },

    /// Create a group (must be on allowlist)
    /// Accounts:
    /// 0. `[writable]` Session PDA
    /// 1. `[writable]` Group PDA
    /// 2. `[signer]` Creator
    /// 3. `[]` System program
    CreateGroup { title: String },

    /// Set group title (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Session PDA
    /// 1. `[writable]` Group PDA
    /// 2. `[signer]` Participant
    SetGroupTitle { group_id: u64, title: String },

    /// Assign note to group (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Session PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[]` Group PDA
    /// 3. `[signer]` Participant
    AssignNoteToGroup { note_id: u64, group_id: u64 },

    /// Unassign note from group (must be on allowlist)
    /// Accounts:
    /// 0. `[]` Session PDA
    /// 1. `[writable]` Note PDA
    /// 2. `[signer]` Participant
    UnassignNote { note_id: u64 },

    /// Cast vote (must be on allowlist)
    /// Creates ParticipantEntry lazily on first vote to track credits
    /// Accounts:
    /// 0. `[]` Session PDA
    /// 1. `[writable]` Participant entry PDA (created if needed)
    /// 2. `[writable]` Group PDA
    /// 3. `[writable]` Vote record PDA
    /// 4. `[signer]` Voter
    /// 5. `[]` System program
    CastVote { group_id: u64, credits_delta: u8 },
}

// Instruction data payloads for Borsh deserialization
#[derive(BorshDeserialize)]
struct CreateSessionPayload {
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

impl RetroInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        Ok(match variant {
            0 => Self::InitTeamRegistry,

            1 => {
                let payload = CreateSessionPayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                Self::CreateSession {
                    categories: payload.categories,
                    allowlist: payload.allowlist,
                    voting_credits_per_participant: payload.voting_credits_per_participant,
                }
            }

            2 => {
                let payload = AdvanceStagePayload::try_from_slice(rest)
                    .map_err(|_| ProgramError::InvalidInstructionData)?;
                let new_stage = match payload.new_stage {
                    0 => SessionStage::Setup,
                    1 => SessionStage::WriteNotes,
                    2 => SessionStage::GroupDuplicates,
                    3 => SessionStage::Vote,
                    4 => SessionStage::Discuss,
                    _ => return Err(ProgramError::InvalidInstructionData),
                };
                Self::AdvanceStage { new_stage }
            }

            3 => Self::CloseSession,

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

            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

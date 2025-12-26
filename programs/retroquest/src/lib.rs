use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;
use state::SessionStage;

declare_id!("RQst1111111111111111111111111111111111111111");

#[program]
pub mod retroquest {
    use super::*;

    // ============ Registry Instructions ============

    pub fn init_team_registry(ctx: Context<InitTeamRegistry>) -> Result<()> {
        instructions::init_team_registry(ctx)
    }

    // ============ Session Instructions ============

    pub fn create_session(ctx: Context<CreateSession>, config: SessionConfig) -> Result<()> {
        instructions::create_session(ctx, config)
    }

    pub fn advance_stage(ctx: Context<AdvanceStage>, new_stage: SessionStage) -> Result<()> {
        instructions::advance_stage(ctx, new_stage)
    }

    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        instructions::close_session(ctx)
    }

    // ============ Participant Instructions ============

    pub fn add_to_allowlist(ctx: Context<AddToAllowlist>, participant_pubkey: Pubkey) -> Result<()> {
        instructions::add_to_allowlist(ctx, participant_pubkey)
    }

    pub fn remove_from_allowlist(ctx: Context<RemoveFromAllowlist>, participant_pubkey: Pubkey) -> Result<()> {
        instructions::remove_from_allowlist(ctx, participant_pubkey)
    }

    pub fn join_session_with_allowlist(ctx: Context<JoinSessionWithAllowlist>) -> Result<()> {
        instructions::join_session_with_allowlist(ctx)
    }

    pub fn join_session_open(ctx: Context<JoinSessionOpen>) -> Result<()> {
        instructions::join_session_open(ctx)
    }

    // ============ Note Instructions ============

    pub fn create_note(ctx: Context<CreateNote>, category_id: u8, content: String) -> Result<()> {
        instructions::create_note(ctx, category_id, content)
    }

    // ============ Group Instructions ============

    pub fn create_group(ctx: Context<CreateGroup>, title: String) -> Result<()> {
        instructions::create_group(ctx, title)
    }

    pub fn set_group_title(ctx: Context<SetGroupTitle>, group_id: u64, title: String) -> Result<()> {
        instructions::set_group_title(ctx, group_id, title)
    }

    pub fn assign_note_to_group(ctx: Context<AssignNoteToGroup>, note_id: u64, group_id: u64) -> Result<()> {
        instructions::assign_note_to_group(ctx, note_id, group_id)
    }

    pub fn unassign_note(ctx: Context<UnassignNote>, note_id: u64) -> Result<()> {
        instructions::unassign_note(ctx, note_id)
    }

    // ============ Vote Instructions ============

    pub fn cast_vote(ctx: Context<CastVote>, group_id: u64, credits_delta: u8) -> Result<()> {
        instructions::cast_vote(ctx, group_id, credits_delta)
    }
}

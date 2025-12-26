use anchor_lang::prelude::*;
use crate::state::TeamRegistry;

#[derive(Accounts)]
pub struct InitTeamRegistry<'info> {
    #[account(
        init,
        payer = team_authority,
        space = 8 + TeamRegistry::INIT_SPACE,
        seeds = [TeamRegistry::SEED_PREFIX, team_authority.key().as_ref()],
        bump
    )]
    pub team_registry: Account<'info, TeamRegistry>,

    #[account(mut)]
    pub team_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_team_registry(ctx: Context<InitTeamRegistry>) -> Result<()> {
    let team_registry = &mut ctx.accounts.team_registry;
    team_registry.team_authority = ctx.accounts.team_authority.key();
    team_registry.session_count = 0;
    team_registry.bump = ctx.bumps.team_registry;
    Ok(())
}

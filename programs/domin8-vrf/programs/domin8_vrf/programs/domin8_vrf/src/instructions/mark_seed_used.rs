use anchor_lang::prelude::*;
use crate::state::{VrfState, GameSeed};
use crate::errors::VrfError;

#[derive(Accounts)]
pub struct MarkSeedUsed<'info> {
    #[account(
        mut,
        seeds = [b"game_seed", game_seed.game_id.as_bytes(), &[game_seed.round]],
        bump,
        constraint = !game_seed.used @ VrfError::SeedAlreadyUsed
    )]
    pub game_seed: Account<'info, GameSeed>,

    #[account(
        seeds = [b"vrf_state"],
        bump,
        has_one = authority @ VrfError::Unauthorized
    )]
    pub vrf_state: Account<'info, VrfState>,

    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<MarkSeedUsed>) -> Result<()> {
    let game_seed = &mut ctx.accounts.game_seed;

    game_seed.used = true;

    msg!("Game seed marked as used: {}", game_seed.game_id);

    Ok(())
}
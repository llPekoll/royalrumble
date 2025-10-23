use anchor_lang::prelude::*;
use crate::state::{GameCounter, GameConfig};
use crate::errors::Domin8Error;
use crate::constants::{GAME_COUNTER_SEED, GAME_CONFIG_SEED};

#[derive(Accounts)]
pub struct SetCounter<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    #[account(constraint = authority.key() == config.authority @ Domin8Error::Unauthorized)]
    pub authority: Signer<'info>,
}

pub fn set_counter(ctx: Context<SetCounter>, new_value: u64) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    let old_value = counter.current_round_id;

    msg!("⚠️ ADMIN: Setting counter from {} to {}", old_value, new_value);
    counter.current_round_id = new_value;
    msg!("✓ Counter updated to: {}", counter.current_round_id);

    Ok(())
}

use anchor_lang::prelude::*;
use crate::state::GameConfig;
use crate::errors::Domin8Error;
use crate::constants::GAME_CONFIG_SEED;

#[derive(Accounts)]
pub struct RotateForce<'info> {
    #[account(
        mut,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    #[account(constraint = authority.key() == config.authority @ Domin8Error::Unauthorized)]
    pub authority: Signer<'info>,
}

pub fn rotate_force(ctx: Context<RotateForce>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;

    let old_force = config.force;
    let mut new_force = [0u8; 32];

    // Use hashv directly with multiple slices (no concat needed)
    use anchor_lang::solana_program::keccak::hashv;
    let hash = hashv(&[
        &clock.unix_timestamp.to_le_bytes(),
        &clock.slot.to_le_bytes(),
        &old_force,
    ]);
    new_force.copy_from_slice(&hash.0);
    config.force = new_force;

    msg!("⚠️ ADMIN: Manually rotated force field");
    msg!("Old force (first 16 bytes): {:?}", &old_force[0..16]);
    msg!("New force (first 16 bytes): {:?}", &new_force[0..16]);

    Ok(())
}

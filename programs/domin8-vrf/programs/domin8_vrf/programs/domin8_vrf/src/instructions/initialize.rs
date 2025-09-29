use anchor_lang::prelude::*;
use crate::state::VrfState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + VrfState::SIZE,
        seeds = [b"vrf_state"],
        bump
    )]
    pub vrf_state: Account<'info, VrfState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let vrf_state = &mut ctx.accounts.vrf_state;

    vrf_state.authority = ctx.accounts.authority.key();
    vrf_state.nonce = 0;

    msg!("VRF initialized with authority: {}", vrf_state.authority);

    Ok(())
}
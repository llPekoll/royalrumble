use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{GameConfig, WinningsClaim};
use crate::constants::{VAULT_SEED, GAME_CONFIG_SEED};
use crate::errors::Domin8Error;

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [b"winnings", round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub winnings_claim: Account<'info, WinningsClaim>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_winnings(
    ctx: Context<ClaimWinnings>,
    round_id: u64,
) -> Result<()> {
    let winnings_claim = &mut ctx.accounts.winnings_claim;
    let claimer = &ctx.accounts.claimer;
    let vault = &ctx.accounts.vault;

    // Verify this is the correct round
    require!(winnings_claim.round_id == round_id, Domin8Error::InvalidGameType);

    // Check if claimer has any winnings to claim
    let mut claim_amount = 0u64;
    let mut found_entry = false;

    // Check winner winnings
    if let Some(entry) = winnings_claim.find_winner_entry_mut(&claimer.key()) {
        require!(!entry.claimed, Domin8Error::AlreadyClaimed);
        claim_amount = entry.amount;
        entry.claimed = true;
        found_entry = true;
    }
    // Check spectator winnings (only if not found in winner winnings)
    else if let Some(entry) = winnings_claim.find_spectator_entry_mut(&claimer.key()) {
        require!(!entry.claimed, Domin8Error::AlreadyClaimed);
        claim_amount = entry.amount;
        entry.claimed = true;
        found_entry = true;
    }

    require!(found_entry, Domin8Error::NoWinningsFound);
    require!(claim_amount > 0, Domin8Error::NoWinningsFound);

    // Verify vault has sufficient funds
    require!(
        vault.lamports() >= claim_amount,
        Domin8Error::InsufficientFunds
    );

    // Transfer winnings from vault to claimer
    let vault_bump = ctx.bumps.vault;
    let seeds = &[VAULT_SEED, &[vault_bump]];
    let signer_seeds = &[&seeds[..]];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: vault.to_account_info(),
                to: claimer.to_account_info(),
            },
            signer_seeds,
        ),
        claim_amount,
    )?;

    msg!(
        "Winnings claimed: {} lamports for wallet {}",
        claim_amount,
        claimer.key()
    );

    Ok(())
}
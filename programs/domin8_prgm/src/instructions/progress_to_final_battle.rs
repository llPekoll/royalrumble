use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus};
use crate::constants::*;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct ProgressToFinalBattle<'info> {
    #[account(
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,
    
    #[account(
        mut,
        seeds = [GAME_ROUND_SEED],
        bump
    )]
    pub game_round: Account<'info, GameRound>,
    
    /// The crank authority that can progress game states
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    /// Switchboard VRF account for winner randomness (placeholder for Phase 5)
    /// CHECK: This will be properly validated when full Switchboard integration is complete
    #[account(mut)]
    pub vrf_account: Option<AccountInfo<'info>>,
}

pub fn progress_to_final_battle(
    ctx: Context<ProgressToFinalBattle>,
) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state - must be SpectatorBetting
    require!(
        game_round.status == GameStatus::SpectatorBetting,
        Domin8Error::InvalidGameStatus
    );
    
    // Validate that we have finalists (should be 4 for large games)
    require!(
        !game_round.finalists.is_empty(),
        Domin8Error::InvalidGameStatus
    );
    
    // Get current slot for VRF commitment
    let clock = Clock::get()?;
    let current_slot = clock.slot;
    
    // Commit to future slot for VRF reveal (commit-reveal pattern)
    let commit_slot = current_slot.saturating_add(10); // Commit to 10 slots in future
    game_round.randomness_commit_slot = commit_slot;
    
    // Store VRF account for winner selection
    if let Some(vrf_account) = &ctx.accounts.vrf_account {
        game_round.winner_randomness_account = vrf_account.key();
        msg!("VRF account for winner selection: {}", vrf_account.key());
    } else {
        // Fallback to a deterministic but future-dependent randomness source
        game_round.winner_randomness_account = Pubkey::default();
    }
    
    // Lock spectator betting and prepare for final winner selection
    game_round.status = GameStatus::AwaitingWinnerRandomness;
    
    msg!("Spectator betting phase ended, preparing for final winner selection");
    msg!("Finalists: {:?}", game_round.finalists);
    msg!("Spectator pot: {} lamports", game_round.spectator_pot);
    msg!("Committed to slot {} for winner randomness", commit_slot);
    
    Ok(())
}
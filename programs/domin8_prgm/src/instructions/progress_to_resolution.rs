use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameStatus};
use crate::constants::*;
use crate::errors::Domin8Error;

#[derive(Accounts)]
pub struct ProgressToResolution<'info> {
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
    /// In Phase 3, we allow the game authority to act as crank
    /// In Phase 7, this will be the dedicated crank service
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,

    /// Switchboard VRF account for randomness (placeholder for Phase 5)
    /// CHECK: This will be properly validated when full Switchboard integration is complete
    #[account(mut)]
    pub vrf_account: Option<AccountInfo<'info>>,
}

pub fn progress_to_resolution(
    ctx: Context<ProgressToResolution>,
) -> Result<()> {
    let game_round = &mut ctx.accounts.game_round;
    
    // Validate game state - must be Waiting
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );
    
    let player_count = game_round.players.len();
    
    msg!("Progressing game to resolution with {} players", player_count);
    
    // Get current slot for VRF commitment
    let clock = Clock::get()?;
    let current_slot = clock.slot;
    
    // Commit to future slot for VRF reveal (commit-reveal pattern)
    // We commit to a slot that's a few slots in the future to prevent manipulation
    let commit_slot = current_slot.saturating_add(10); // Commit to 10 slots in future
    game_round.randomness_commit_slot = commit_slot;
    
    match player_count {
        0 => {
            // This shouldn't happen as we require at least one player to transition to Waiting
            return Err(Domin8Error::InvalidGameStatus.into());
        },
        1 => {
            // Single player - immediate refund scenario
            game_round.status = GameStatus::Finished;
            
            msg!("Single player game - marking for refund");
        },
        2..=MAX_PLAYERS => {
            // Small game - direct winner selection
            game_round.status = GameStatus::AwaitingWinnerRandomness;
            
            // For simplified VRF, we store a placeholder VRF account
            // In full Switchboard integration, this would be a real randomness account
            if let Some(vrf_account) = &ctx.accounts.vrf_account {
                game_round.winner_randomness_account = vrf_account.key();
                msg!("VRF account for winner selection: {}", vrf_account.key());
            } else {
                // Fallback to a deterministic but future-dependent randomness source
                game_round.winner_randomness_account = Pubkey::default();
            }
            
            msg!("Small game ({} players) - committed to slot {} for winner selection", 
                 player_count, commit_slot);
        },
        _ => {
            // This shouldn't happen due to MAX_PLAYERS validation in deposit_bet
            return Err(Domin8Error::MaxPlayersReached.into());
        }
    }
    
    msg!("Game status updated to: {:?}, committed to slot: {}", 
         game_round.status, commit_slot);
    
    Ok(())
}
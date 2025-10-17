use anchor_lang::prelude::*;
use crate::state::{GameRound, GameConfig, GameCounter, GameStatus};
use crate::errors::Domin8Error;
use crate::constants::{GAME_ROUND_SEED, GAME_CONFIG_SEED, GAME_COUNTER_SEED};
use crate::events::GameLocked;

#[derive(Accounts)]
pub struct UnifiedProgressToResolution<'info> {
    #[account(
        seeds = [GAME_COUNTER_SEED],
        bump
    )]
    pub counter: Account<'info, GameCounter>,

    #[account(
        mut,
        seeds = [GAME_ROUND_SEED, counter.current_round_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_round: Account<'info, GameRound>,

    #[account(
        mut,
        seeds = [GAME_CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GameConfig>,

    /// The crank authority
    #[account(
        constraint = crank.key() == config.authority @ Domin8Error::Unauthorized
    )]
    pub crank: Signer<'info>,
}

/// UNIFIED INSTRUCTION: Progress game from Waiting directly to AwaitingWinnerRandomness
/// This replaces the old progress_to_resolution + separate VRF request
pub fn unified_progress_to_resolution(ctx: Context<UnifiedProgressToResolution>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let game_round = &mut ctx.accounts.game_round;
    let clock = Clock::get()?;

    // Validate game state
    require!(
        game_round.status == GameStatus::Waiting,
        Domin8Error::InvalidGameStatus
    );

    // ⭐ Validate betting window has closed (prevents early progression)
    require!(
        clock.unix_timestamp >= game_round.end_timestamp,
        Domin8Error::BettingWindowStillOpen
    );

    // ⭐ Lock the game to prevent new bets during resolution
    config.game_locked = true;

    let bet_count = game_round.bets.len();
    msg!("Unified progress: transitioning game {} with {} bets", game_round.round_id, bet_count);
    msg!("Game locked - no new bets allowed during resolution");

    // Validate minimum bets
    require!(
        bet_count >= 2,
        Domin8Error::InvalidGameStatus
    );

    if bet_count == 1 {
        // Single bet - immediate finish with refund
        game_round.status = GameStatus::Finished;
        game_round.winner = game_round.bets[0].wallet;
        msg!("Single bet game - immediate finish with refund");
        return Ok(());
    }

    // Multi-bet game (2+ bets) - VRF was already requested at game creation
    // Just transition to AwaitingWinnerRandomness status
    // No upper limit - unlimited bets supported via dynamic reallocation

    // Verify VRF was requested during game creation
    require!(
        game_round.vrf_request_pubkey != Pubkey::default(),
        Domin8Error::InvalidVrfAccount
    );

    // Update game state to AwaitingWinnerRandomness
    game_round.status = GameStatus::AwaitingWinnerRandomness;

    msg!("Game {} now awaiting winner randomness - VRF already requested at game creation", game_round.round_id);
    msg!("VRF Request: {}", game_round.vrf_request_pubkey);

    // ⭐ Emit game locked event
    emit!(GameLocked {
        round_id: game_round.round_id,
        final_bet_count: game_round.bets.len() as u8,
        total_pot: game_round.initial_pot,
        vrf_request_pubkey: game_round.vrf_request_pubkey,
    });

    Ok(())
}